import React, { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

const TOTESDOC = doc(db, "totes", "totesUsed");
const DATADOC = doc(db, "totes", "data");

function parseNumber(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

export default function TotesUsedCard({
  rows,
  routesInfo,
  grandTotals,
  duplicateMessage,
  onFileChange,
  clearAll,
}) {
  const [dolliesReceived, setDolliesReceived] = useState("");
  const [dolliesUsed, setDolliesUsed] = useState("");
  const [dolliesEmpty, setDolliesEmpty] = useState("");
  const [dolliesResult, setDolliesResult] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2200);
  };

  useEffect(() => {
    const unsub = onSnapshot(TOTESDOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setDolliesReceived(d.dolliesReceived ?? "");
      setDolliesUsed(d.dolliesUsed ?? "");
      setDolliesEmpty(d.dolliesEmpty ?? "");
      setDolliesResult(d.dolliesResult ?? null);
    });

    return unsub;
  }, []);

  const calculateDollies = async () => {
    const result = parseNumber(dolliesUsed) + parseNumber(dolliesEmpty) - parseNumber(dolliesReceived);
    setDolliesResult(result);
    await setDoc(
      TOTESDOC,
      {
        dolliesReceived,
        dolliesUsed,
        dolliesEmpty,
        dolliesResult: result,
      },
      { merge: true }
    );
    showToast("Dollies saved");
  };

  const clearDollies = async () => {
    setDolliesReceived("");
    setDolliesUsed("");
    setDolliesEmpty("");
    setDolliesResult(null);
    await setDoc(
      TOTESDOC,
      {
        dolliesReceived: "",
        dolliesUsed: "",
        dolliesEmpty: "",
        dolliesResult: null,
      },
      { merge: true }
    );
    showToast("Dollies cleared");
  };

  const totalConsignments = Object.values(routesInfo).reduce((sum, r) => sum + r.rows.length, 0);
  const totalFrames = (totalConsignments * 4) + 20;

  return (
    <section className="data-card totes-used-card">
      <h2 className="data-title">Totes Used</h2>

      <div className="totes-used-grid">
        <div className="subcard">
          <h3>Uploaded Data</h3>

          <div className="file-controls">
            <input type="file" accept=".csv" multiple onChange={onFileChange} />
            <button onClick={clearAll} className="clear-btn" disabled={rows.length === 0}>
              Clear uploaded data
            </button>
          </div>

          {duplicateMessage && <p className="duplicate-warning">{duplicateMessage}</p>}

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
                  {Object.entries(routesInfo).map(([route, data], i) => {
                    const consignments = data.rows.length;
                    const frames = Math.ceil(consignments / 4);
                    return (
                      <tr key={i}>
                        <td>{route}</td>
                        <td>{consignments}</td>
                        <td>{data.totals.ambient}</td>
                        <td>{data.totals.chilled}</td>
                        <td>{data.totals.freezer}</td>
                        <td className="bold">{data.totals.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grand-totals">
            <h3>Grand Totals</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Total Consignments</th>
                    <th>Total Frames</th>
                    <th>Ambient</th>
                    <th>Chilled</th>
                    <th>Freezer</th>
                    <th>Total Totes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="bold">{totalConsignments}</td>
                    <td className="bold">{totalFrames}</td>
                    <td>{grandTotals.ambient}</td>
                    <td>{grandTotals.chilled}</td>
                    <td>{grandTotals.freezer}</td>
                    <td className="bold">{grandTotals.total}</td>
                  </tr>
                </tbody>

              </table>
              
            </div>
            
          </div>
          *Grand Total includes 5 recovery vans
        </div>

        <div className="subcard">
          <h3>Dollies</h3>

          <div className="bagged-fields">
            <div className="bagged-row">
              <span>Dollies Received</span>
              <input
                type="number"
                value={dolliesReceived}
                onChange={(e) => setDolliesReceived(e.target.value)}
              />
            </div>

            <div className="bagged-row">
              <span>Dollies Used</span>
              <input
                type="number"
                value={dolliesUsed}
                onChange={(e) => setDolliesUsed(e.target.value)}
              />
            </div>

            <div className="bagged-row">
              <span>Dollies Empty</span>
              <input
                type="number"
                value={dolliesEmpty}
                onChange={(e) => setDolliesEmpty(e.target.value)}
              />
            </div>
          </div>

          <div className="center-buttons">
            <button className="calculate-btn" onClick={calculateDollies}>
              Calculate
            </button>
            <button className="clear-btn" onClick={clearDollies}>
              Clear
            </button>
          </div>

          {dolliesResult !== null && (
            <div className="bagged-result" style={{ marginTop: 20 }}>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: 18 }}>
                <span>Dollies Dekitted</span>
                <span style={{ marginLeft: 8 }}>{dolliesResult}</span>
              </div>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: 18 }}>
                <span>Totes Dekitted</span>
                <span style={{ marginLeft: 8 }}>{dolliesResult * 15}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}