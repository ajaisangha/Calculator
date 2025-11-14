import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";

const TOTES_DOC = doc(db, "totes", "totesUsed"); // Firestore document

export default function TotesUsedCard({
  rows,
  routesInfo,
  grandTotals,
  duplicateMessage,
  onFileChange,
  clearAll
}) {
  // --- Dollies State ---
  const [dolliesReceived, setDolliesReceived] = useState(0);
  const [dolliesUsed, setDolliesUsed] = useState(0);
  const [dolliesEmpty, setDolliesEmpty] = useState(0);
  const [dolliesResult, setDolliesResult] = useState(null);

  // --- Load Dollies data from Firestore ---
  useEffect(() => {
    const unsubscribe = onSnapshot(TOTES_DOC, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDolliesReceived(data.dolliesReceived || 0);
        setDolliesUsed(data.dolliesUsed || 0);
        setDolliesEmpty(data.dolliesEmpty || 0);
        setDolliesResult(data.dolliesResult ?? null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Dollies Actions ---
  const calculateDollies = async () => {
    const result = (parseInt(dolliesUsed, 10) || 0) + (parseInt(dolliesEmpty, 10) || 0) - (parseInt(dolliesReceived, 10) || 0);
    setDolliesResult(result);
    await setDoc(TOTES_DOC, {
      dolliesReceived,
      dolliesUsed,
      dolliesEmpty,
      dolliesResult: result
    }, { merge: true });
  };

  const clearDollies = async () => {
    setDolliesReceived(0);
    setDolliesUsed(0);
    setDolliesEmpty(0);
    setDolliesResult(null);
    await setDoc(TOTES_DOC, {
      dolliesReceived: 0,
      dolliesUsed: 0,
      dolliesEmpty: 0,
      dolliesResult: null
    }, { merge: true });
  };

  return (
    <section className="data-card adaptive-card">
      <h2 className="data-title">Totes Used</h2>

      {/* --- File Controls --- */}
      <div className="file-controls">
        <input type="file" accept=".csv" multiple onChange={onFileChange} />
        <button onClick={clearAll} disabled={rows.length === 0} className="clear-btn">
          Clear uploaded data
        </button>
      </div>
      {duplicateMessage && <p className="duplicate-warning">{duplicateMessage}</p>}

      {/* --- Routes Table --- */}
      {Object.keys(routesInfo).length === 0 ? (
        <p className="no-data">No data available yet.</p>
      ) : (
        <div className="table-container">
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
                  <td>{data.rows.length}</td>
                  <td>{data.totals.ambient}</td>
                  <td>{data.totals.chilled}</td>
                  <td>{data.totals.freezer}</td>
                  <td className="bold">{data.totals.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* --- Grand Totals --- */}
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
        </div>
      )}

      {/* --- Dollies Section --- */}
      <div className="dollies-section" style={{ marginTop: "20px" }}>
        <h3>Dollies</h3>
        <div className="dollies-flex" style={{ display: "flex", alignItems: "center", gap: "20px" }}>

          {/* Left: Inputs */}
          <div className="bagged-fields" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="bagged-row">
              <span>Dollies Received:</span>
              <input
                type="number"
                value={dolliesReceived}
                onChange={(e) => setDolliesReceived(e.target.value)}
                className="bagged-input"
              />
            </div>
            <div className="bagged-row">
              <span>Dollies Used:</span>
              <input
                type="number"
                value={dolliesUsed}
                onChange={(e) => setDolliesUsed(e.target.value)}
                className="bagged-input"
              />
            </div>
            <div className="bagged-row">
              <span>Dollies Empty:</span>
              <input
                type="number"
                value={dolliesEmpty}
                onChange={(e) => setDolliesEmpty(e.target.value)}
                className="bagged-input"
              />
            </div>
          </div>

          {/* Middle: Buttons */}
          <div className="dollies-buttons" style={{ display: "flex", gap: "12px" }}>
            <button className="calculate-btn" onClick={calculateDollies}>
              Calculate
            </button>
            <button className="clear-btn" onClick={clearDollies}>
              Clear
            </button>
          </div>

          {/* Right: Result */}
          <div className="bagged-result" style={{ marginLeft: "20px" }}>
            {dolliesResult !== null && (
              <div className="result-line">
                <span>Dollies Dekitted:</span>
                <span style={{ fontWeight: "bold", marginLeft: "8px" }}>{dolliesResult}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
