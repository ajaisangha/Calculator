import React, { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import "./totesused.css";

const TOTESDOC = doc(db, "totes", "totesUsed");

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
    const result =
      parseNumber(dolliesUsed) +
      parseNumber(dolliesEmpty) -
      parseNumber(dolliesReceived);

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

  const routeOrder = [
    { key: "Ottawa Spoke", short: "Ottawa" },
    { key: "2:30 Etobicoke Spoke", short: "2:30 ES" },
    { key: "3:00 Etobicoke Spoke", short: "3:00 ES" },
    { key: "5:30 Etobicoke Spoke", short: "5:30 ES" },
    { key: "Vans", short: "Vans" },
    { key: "8:45 Etobicoke Spoke", short: "8:45 ES" },
    { key: "9:15 Etobicoke Spoke", short: "9:15 ES" },
  ];

  const getRowOvercapacity = (row) => {
    let overcapacity = 0;

    if ((row.ambient || 0) > 40) overcapacity += 1;
    if (((row.chilled || 0) + (row.freezer || 0)) > 40) overcapacity += 1;

    return overcapacity;
  };

  const totalOvercapacity = rows.reduce((sum, row) => sum + getRowOvercapacity(row), 0);

  const routeSummary = routeOrder.map((route) => {
    const routeRows = routesInfo[route.key]?.rows || [];
    const count = routeRows.length;
    const overcapacity = routeRows.reduce((sum, row) => sum + getRowOvercapacity(row), 0);
    const isVan = route.key === "Vans";
    return { ...route, count, overcapacity, isVan };
  });

  const totalSpokeRoutes = routeSummary
    .filter((r) => !r.isVan)
    .reduce((sum, r) => sum + r.count, 0);

  const totalSpokeFrames = totalSpokeRoutes * 4;

  const totalVanRoutes = routeSummary
    .filter((r) => r.isVan)
    .reduce((sum, r) => sum + r.count, 0);

  const totalVanFrames = totalVanRoutes * 4;

  const totalFrames = totalSpokeFrames + totalVanFrames + 20;

  const handleClearUpload = () => {
    clearAll();
  };

  return (
    <section className="data-card totes-used-card">
      <h2 className="data-title">Totes Used</h2>

      <div className="totes-used-grid">
        <div className="subcard upload-card">
          <h3>Uploaded Data</h3>

          <div className="file-controls">
            <input type="file" accept=".csv" multiple onChange={onFileChange} />
            <button onClick={handleClearUpload} className="clear-btn" disabled={rows.length === 0}>
              Clear uploaded data
            </button>
          </div>

          {duplicateMessage && <p className="duplicate-warning">{duplicateMessage}</p>}

          {Object.keys(routesInfo).length === 0 ? (
            <p className="no-data">No data available yet.</p>
          ) : (
            <div
              style={{
                marginTop: "18px",
                background: "#ffffff",
                border: "1px solid #e4edf8",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <h3 style={{ marginBottom: "14px" }}>Consignment Summary</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                  gap: "12px",
                }}
              >
                {routeSummary.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      background: "#f8fbff",
                      border: "1px solid #dbe7f6",
                      borderRadius: "12px",
                      padding: "12px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#123c73",
                        lineHeight: 1.3,
                        minHeight: "34px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.short}
                    </div>

                    <div
                      style={{
                        fontSize: "28px",
                        fontWeight: 800,
                        color: "#007bff",
                        lineHeight: 1.1,
                        marginTop: "8px",
                      }}
                    >
                      {item.count}
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#5b6472",
                        marginTop: "4px",
                      }}
                    >
                      Routes
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: item.overcapacity > 0 ? "#d9534f" : "#5b6472",
                        fontWeight: 700,
                        marginTop: "6px",
                      }}
                    >
                      OC: {item.overcapacity}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "14px",
                  background: "#edf5ff",
                  border: "1px solid #cfe0f8",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#123c73",
                  }}
                >
                  Total Overcapacity
                </div>

                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 900,
                    color: totalOvercapacity > 0 ? "#d9534f" : "#007bff",
                    lineHeight: 1,
                  }}
                >
                  {totalOvercapacity}
                </div>
              </div>
            </div>
          )}
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

        <div className="subcard grand-total-card">
          <h3>Grand Total</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
              gap: "12px",
              marginTop: "6px",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4edf8",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#5b6472", fontWeight: 600 }}>
                Total Spoke Routes
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px" }}>
                {totalSpokeRoutes}
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4edf8",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#5b6472", fontWeight: 600 }}>
                Total Spoke Frames
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px" }}>
                {totalSpokeFrames}
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4edf8",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#5b6472", fontWeight: 600 }}>
                Total Vans
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px" }}>
                {totalVanRoutes}
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4edf8",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#5b6472", fontWeight: 600 }}>
                Total Van Frames
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px" }}>
                {totalVanFrames}
              </div>
            </div>

            <div
              style={{
                background: "#edf5ff",
                border: "1px solid #cfe0f8",
                borderRadius: "10px",
                padding: "10px 12px",
                minHeight: "82px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#123c73",
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                Total Frames
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  marginTop: "4px",
                  color: "#007bff",
                  lineHeight: 1,
                }}
              >
                {totalFrames}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#5b6472",
                  marginTop: "3px",
                  lineHeight: 1.15,
                }}
              >
                Spoke frames + van frames + 20
              </div>
            </div>

            <div
              style={{
                background: "#f4f9ff",
                border: "1px solid #cfe0f8",
                borderRadius: "10px",
                padding: "10px 12px",
                minHeight: "82px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#123c73",
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                Total Totes
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  marginTop: "4px",
                  color: "#007bff",
                  lineHeight: 1,
                }}
              >
                {grandTotals.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}