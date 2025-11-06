import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyDbGd7qUUDgLo3HsrbsCbK8GySajQeKFu0",
  authDomain: "tote-calculator.firebaseapp.com",
  projectId: "tote-calculator",
  storageBucket: "tote-calculator.firebasestorage.app",
  messagingSenderId: "256755403923",
  appId: "1:256755403923:web:1931c6e83190d77eaa1166"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Header Component ---
function Header() {
  return (
    <header className="header">
      <h1 className="header-title">Totes Calculator</h1>
    </header>
  );
}

// --- Main App Component ---
export default function App() {
  const [routesInfo, setRoutesInfo] = useState({});
  const [grandTotals, setGrandTotals] = useState({ ambient: 0, chilled: 0, freezer: 0, total: 0 });
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const globalConsignments = useRef(new Set());

  // --- Bagged Totes State ---
  const [bagged, setBagged] = useState({
    ambientReceived: '',
    chilledReceived: '',
    currentAmbient: '',
    currentChilled: '',
    baggedAmbient: 0,
    baggedChilled: 0
  });

  // --- Parse cell helper ---
  const parseToteCell = (cell) => {
    if (!cell && cell !== 0) return 0;
    const str = String(cell).trim();
    if (!str) return 0;
    const nums = (str.match(/-?\d+/g) || []).map(n => parseInt(n, 10));
    return nums.length ? Math.max(...nums.map(Math.abs)) : 0;
  };

  // --- Determine route ---
  const getRouteName = (row) => {
    const dispatch = row['Dispatch time'] || row['dispatch time'] || row['Dispatch Time'] || '';
    if (['11:15', '11:16', '11:17'].includes(dispatch)) return 'Ottawa';
    if (dispatch === '2:30') return 'Etobicoke 1';
    if (dispatch === '3:00') return 'Etobicoke 2';
    if (dispatch === '5:30') return 'Etobicoke 3';
    if (dispatch === '8:45') return 'Etobicoke 4';
    if (dispatch === '9:15') return 'Etobicoke 5';
    return 'Vans';
  };

  // --- Compute totals from rows ---
  const computeTotalsFromRows = (rows, seenGlobal) => {
    let ambient = 0, chilled = 0, freezer = 0, duplicateCount = 0;
    const processedRows = [];
    const seenConsignments = new Set();

    rows.forEach(r => {
      const consignment = (r['Consignment'] || '').trim();
      if (!consignment) return;
      if (seenConsignments.has(consignment) || seenGlobal.has(consignment)) {
        duplicateCount++;
        return;
      }
      seenConsignments.add(consignment);
      seenGlobal.add(consignment);
      processedRows.push(r);
    });

    if (!processedRows.length) return { ambient: 0, chilled: 0, freezer: 0, total: 0, duplicateCount };

    const headers = Object.keys(processedRows[0]);
    const pickCol = (pattern) => headers.find(h => new RegExp(pattern, 'i').test(h));
    const ambientKey = pickCol('Completed\\s*Totes.*Ambient') || pickCol('ambient');
    const chilledKey = pickCol('Completed\\s*Totes.*Chilled') || pickCol('chill|chilled');
    const freezerKey = pickCol('Completed\\s*Totes.*Freezer') || pickCol('freezer');

    processedRows.forEach(r => {
      ambient += ambientKey ? parseToteCell(r[ambientKey]) : 0;
      chilled += chilledKey ? parseToteCell(r[chilledKey]) : 0;
      freezer += freezerKey ? parseToteCell(r[freezerKey]) : 0;
    });

    return { ambient, chilled, freezer, total: ambient + chilled + freezer, duplicateCount };
  };

  // --- Handle File Upload ---
  const handleFiles = (files) => {
    let duplicates = 0;
    Array.from(files).forEach(file => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data;
          const newRoutesInfo = { ...routesInfo };

          const routeGroups = {};
          rows.forEach(r => {
            const route = getRouteName(r);
            if (!routeGroups[route]) routeGroups[route] = [];
            routeGroups[route].push(r);
          });

          for (const [route, rowsForRoute] of Object.entries(routeGroups)) {
            const totals = computeTotalsFromRows(rowsForRoute, globalConsignments.current);
            duplicates += totals.duplicateCount;

            // Merge totals
            if (!newRoutesInfo[route]) {
              newRoutesInfo[route] = { totals: { ...totals }, consignments: rowsForRoute.length };
            } else {
              newRoutesInfo[route].totals.ambient += totals.ambient;
              newRoutesInfo[route].totals.chilled += totals.chilled;
              newRoutesInfo[route].totals.freezer += totals.freezer;
              newRoutesInfo[route].totals.total += totals.total;
              newRoutesInfo[route].totals.duplicateCount += totals.duplicateCount;
              newRoutesInfo[route].consignments += rowsForRoute.length;
            }

            // --- Save only optimized data to Firestore ---
            const batchDoc = doc(collection(db, 'totes'), route);
            await setDoc(batchDoc, {
              consignments: newRoutesInfo[route].consignments,
              ambient: newRoutesInfo[route].totals.ambient,
              chilled: newRoutesInfo[route].totals.chilled,
              freezer: newRoutesInfo[route].totals.freezer,
              total: newRoutesInfo[route].totals.total
            });
          }

          setRoutesInfo(newRoutesInfo);
          setDuplicateWarning(duplicates > 0 ? `${duplicates} duplicate lines detected` : '');

          // Compute grand totals
          const newGrand = Object.values(newRoutesInfo).reduce((acc, cur) => {
            acc.ambient += cur.totals.ambient;
            acc.chilled += cur.totals.chilled;
            acc.freezer += cur.totals.freezer;
            acc.total += cur.totals.total;
            return acc;
          }, { ambient: 0, chilled: 0, freezer: 0, total: 0 });
          setGrandTotals(newGrand);
        }
      });
    });
  };

  const onFileChange = (e) => {
    if (!e.target.files.length) return;
    handleFiles(e.target.files);
    e.target.value = null;
  };

  const clearAll = async () => {
    setRoutesInfo({});
    setGrandTotals({ ambient: 0, chilled: 0, freezer: 0, total: 0 });
    setDuplicateWarning('');
    globalConsignments.current.clear();

    // Clear Firestore
    const totesRef = collection(db, 'totes');
    const snapshot = await getDoc(doc(db, 'totes', 'dummy')); // dummy call to ensure connection
    // For simplicity, user can manually delete docs or implement batch delete if needed
  };

  // --- Bagged Tote Calculation ---
  const calculateBagged = () => {
    const baggedAmbient =
      Number(bagged.currentAmbient || 0) + grandTotals.ambient - Number(bagged.ambientReceived || 0);
    const baggedChilled =
      Number(bagged.currentChilled || 0) + grandTotals.chilled - Number(bagged.chilledReceived || 0);
    setBagged({ ...bagged, baggedAmbient, baggedChilled });
  };

  const handleBaggedChange = (e) => {
    setBagged({ ...bagged, [e.target.name]: e.target.value });
  };

  // --- Load Firestore Data on Mount ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'totes'), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => {
        const d = doc.data();
        data[doc.id] = {
          totals: {
            ambient: d.ambient || 0,
            chilled: d.chilled || 0,
            freezer: d.freezer || 0,
            total: d.total || 0,
            duplicateCount: 0
          },
          consignments: d.consignments || 0
        };
      });
      setRoutesInfo(data);

      // Compute grand totals
      const newGrand = Object.values(data).reduce((acc, cur) => {
        acc.ambient += cur.totals.ambient;
        acc.chilled += cur.totals.chilled;
        acc.freezer += cur.totals.freezer;
        acc.total += cur.totals.total;
        return acc;
      }, { ambient: 0, chilled: 0, freezer: 0, total: 0 });
      setGrandTotals(newGrand);
    });
    return () => unsub();
  }, []);

  return (
    <div className="app-container">
      <Header />
      <div className="content">
        {/* Left Card: Totes Used */}
        <div className="data-card">
          <h2 className="data-title">Totes Used</h2>
          <div className="file-controls">
            <input type="file" accept=".csv" multiple onChange={onFileChange} />
            <button className="clear-btn" onClick={clearAll} disabled={!Object.keys(routesInfo).length}>
              Clear uploaded data
            </button>
          </div>
          {duplicateWarning && <p className="duplicate-warning">{duplicateWarning}</p>}
          <div className="table-container">
            {Object.keys(routesInfo).length ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Consignments</th>
                      <th>Ambient</th>
                      <th>Chilled</th>
                      <th>Freezer</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(routesInfo).map(([route, data], i) => (
                      <tr key={i}>
                        <td>{route}</td>
                        <td>{data.consignments}</td>
                        <td>{data.totals.ambient}</td>
                        <td>{data.totals.chilled}</td>
                        <td>{data.totals.freezer}</td>
                        <td className="bold">{data.totals.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="grand-totals">
                  <h3>Grand Totals</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ambient</th>
                        <th>Chilled</th>
                        <th>Freezer</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{grandTotals.ambient}</td>
                        <td>{grandTotals.chilled}</td>
                        <td>{grandTotals.freezer}</td>
                        <td className="bold">{grandTotals.total}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="no-data">No data available yet.</p>
            )}
          </div>
        </div>

        {/* Right Card: Bagged Totes */}
        <div className="data-card" style={{ marginLeft: '32px', maxWidth: '500px' }}>
          <h2 className="data-title">Bagged Totes</h2>
          <div className="file-controls">
            <label>
              Ambient Totes Received:
              <input type="number" name="ambientReceived" value={bagged.ambientReceived} onChange={handleBaggedChange} />
            </label>
            <br />
            <label>
              Chilled Totes Received:
              <input type="number" name="chilledReceived" value={bagged.chilledReceived} onChange={handleBaggedChange} />
            </label>
            <br />
            <label>
              Current Totes in Hive (Ambient):
              <input type="number" name="currentAmbient" value={bagged.currentAmbient} onChange={handleBaggedChange} />
            </label>
            <br />
            <label>
              Current Totes in Hive (Chilled):
              <input type="number" name="currentChilled" value={bagged.currentChilled} onChange={handleBaggedChange} />
            </label>
            <br />
            <button className="clear-btn" onClick={calculateBagged}>Calculate Bagged Totes</button>
          </div>
          <div style={{ marginTop: '16px' }}>
            <p>Bagged Ambient: <strong>{bagged.baggedAmbient}</strong></p>
            <p>Bagged Chilled: <strong>{bagged.baggedChilled}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
