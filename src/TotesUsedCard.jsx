import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";

const TOTES_DOC = doc(db, "totes", "totesUsed");

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

  const [notification, setNotification] = useState("");
  const [showToast, setShowToast] = useState(false);

  // ---- Load Dollies from Firestore ----
  useEffect(() => {
    const unsub = onSnapshot(TOTES_DOC, (snap) => {
      if (!snap.exists()) return;

      const d = snap.data();
      setDolliesReceived(d.dolliesReceived || 0);
      setDolliesUsed(d.dolliesUsed || 0);
      setDolliesEmpty(d.dolliesEmpty || 0);
      setDolliesResult(d.dolliesResult ?? null);
    });

    return () => unsub();
  }, []);

  // ---- Dollies Calculate ----
  const calculateDollies = async () => {
    const result =
      (parseInt(dolliesUsed) || 0) +
      (parseInt(dolliesEmpty) || 0) -
      (parseInt(dolliesReceived) || 0);

    setNotification(dolliesResult === null ? "Added" : "Updated");
    setShowToast(true);

    setDolliesResult(result);

    await setDoc(
      TOTES_DOC,
      {
        dolliesReceived,
        dolliesUsed,
        dolliesEmpty,
        dolliesResult: result
      },
      { merge: true }
    );

    setTimeout(() => setShowToast(false), 2500);
  };

  const clearDollies = async () => {
    setDolliesReceived(0);
    setDolliesUsed(0);
    setDolliesEmpty(0);
    setDolliesResult(null);
    setNotification("");
    setShowToast(false);

    await setDoc(
      TOTES_DOC,
      {
        dolliesReceived: 0,
        dolliesUsed: 0,
        dolliesEmpty: 0,
        dolliesResult: null
      },
      { merge: true }
    );
  };

  // ------------------------------------------------------------------
  // 🔥 GRAND TOTALS CALCULATION (requested update)
  // ------------------------------------------------------------------
  const totalConsignments = Object.values(routesInfo).reduce(
    (sum, r) => sum + r.rows.length,
    0
  );

  const totalFrames = totalConsignments * 4 + 20; // +20 as requested

  // ------------------------------------------------------------------

  return (
    <section className="data-card adaptive-card">
      <h2 className="data-title">Totes Used</h2>

      {/* Upload Buttons */}
      <div className="file-controls">
        <input type="file" accept=".csv" multiple onChange={onFileChange} />
        <button
          onClick={clearAll}
          disabled={rows.length === 0}
          className="clear-btn"
        >
          Clear uploaded data
        </button>
      </div>

      {duplicateMessage && (
        <p className="duplicate-warning">{duplicateMessage}</p>
      )}

      {/* ----------------------------------------------------
          ROUTES TABLE + FRAMES COLUMN
         ---------------------------------------------------- */}
      {Object.keys(routesInfo).length === 0 ? (
        <p className="no-data">No data available yet.</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Consignments</th>
                <th>Frames</th>
                <th>Ambient</th>
                <th>Chilled</th>
                <th>Freezer</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {Object.entries(routesInfo).map(([route, data], i) => {
                const consignments = data.rows.length;
                const frames = consignments * 4;

                return (
                  <tr key={i}>
                    <td>{route}</td>
                    <td>{consignments}</td>
                    <td>{frames}</td>
                    <td>{data.totals.ambient}</td>
                    <td>{data.totals.chilled}</td>
                    <td>{data.totals.freezer}</td>
                    <td className="bold">{data.totals.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ----------------------------------------------------
              GRAND TOTALS SECTION (UPDATED)
             ---------------------------------------------------- */}
          <div className="grand-totals" style={{ marginTop: "20px" }}>
            <h3>Grand Totals</h3>

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
      )}

      {/* ----------------------------------------------------
          DOLLIES SECTION
         ---------------------------------------------------- */}
      <div className="dollies-section" style={{ marginTop: "20px" }}>
        <h3>Dollies</h3>

        <div
          className="dollies-flex"
          style={{ display: "flex", alignItems: "center", gap: "20px" }}
        >
          {/* Inputs */}
          <div
            className="bagged-fields"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div className="bagged-row">
              <span>Dollies Received:</span>
              <input
                type="number"
                value={dolliesReceived}
                onChange={(e) => setDolliesReceived(e.target.value)}
              />
            </div>

            <div className="bagged-row">
              <span>Dollies Used:</span>
              <input
                type="number"
                value={dolliesUsed}
                onChange={(e) => setDolliesUsed(e.target.value)}
              />
            </div>

            <div className="bagged-row">
              <span>Dollies Empty:</span>
              <input
                type="number"
                value={dolliesEmpty}
                onChange={(e) => setDolliesEmpty(e.target.value)}
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="calculate-btn" onClick={calculateDollies}>
              Calculate
            </button>
            <button className="clear-btn" onClick={clearDollies}>
              Clear
            </button>
          </div>

          {/* Result */}
          <div className="bagged-result" style={{ marginLeft: "20px" }}>
            {dolliesResult !== null && (
              <div className="result-line">
                <span>Dollies Dekitted:</span>
                <span style={{ fontWeight: "bold", marginLeft: "8px" }}>
                  {dolliesResult}
                </span>
              </div>
            )}

            {showToast && (
              <div className="toast-notification-center">{notification}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
