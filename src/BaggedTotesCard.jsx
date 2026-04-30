import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import "./App.css";

const BAGGED_TOTES_DOC = doc(db, "totes", "baggedTotes");

export default function BaggedTotesCard({
  grandTotals,
  receivedAmbient,
  receivedChill,
  currentAmbient,
  currentChill,
  setReceivedAmbient,
  setReceivedChill,
  setCurrentAmbient,
  setCurrentChill,
}) {
  const [baggedAmbient, setBaggedAmbient] = useState(null);
  const [baggedChill, setBaggedChill] = useState(null);
  const [usedAmbient, setUsedAmbient] = useState(0);
  const [usedChill, setUsedChill] = useState(0);

  const [currentAmbient2, setCurrentAmbient2] = useState("");
  const [currentChill2, setCurrentChill2] = useState("");
  const [neededAmbient, setNeededAmbient] = useState("");
  const [neededChill, setNeededChill] = useState("");
  const [leavingAmbient, setLeavingAmbient] = useState("");
  const [leavingChill, setLeavingChill] = useState("");
  const [resultAmbient, setResultAmbient] = useState(null);
  const [resultChill, setResultChill] = useState(null);

  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  useEffect(() => {
    const unsub = onSnapshot(BAGGED_TOTES_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      setReceivedAmbient(d.receivedAmbient || "");
      setReceivedChill(d.receivedChill || "");
      setCurrentAmbient(d.currentAmbient || "");
      setCurrentChill(d.currentChill || "");
      setBaggedAmbient(d.baggedAmbient ?? null);
      setBaggedChill(d.baggedChill ?? null);
      setUsedAmbient(d.usedAmbient ?? 0);
      setUsedChill(d.usedChill ?? 0);

      setCurrentAmbient2(d.currentAmbient2 || "");
      setCurrentChill2(d.currentChill2 || "");
      setNeededAmbient(d.neededAmbient || "");
      setNeededChill(d.neededChill || "");
      setLeavingAmbient(d.leavingAmbient || "");
      setLeavingChill(d.leavingChill || "");
      setResultAmbient(d.resultAmbient ?? null);
      setResultChill(d.resultChill ?? null);
    });

    return () => unsub();
  }, [setReceivedAmbient, setReceivedChill, setCurrentAmbient, setCurrentChill]);

  const calculateBaggedTotes = async () => {
    const ambientReceivedNum = parseInt(receivedAmbient, 10) || 0;
    const chillReceivedNum = parseInt(receivedChill, 10) || 0;
    const currentAmbientNum = parseInt(currentAmbient, 10) || 0;
    const currentChillNum = parseInt(currentChill, 10) || 0;

    const ambient = (grandTotals.ambient || 0) + currentAmbientNum - ambientReceivedNum;
    const chill = (grandTotals.chilled || 0) + currentChillNum - chillReceivedNum;

    const ambientUsed = (grandTotals.ambient || 0) - ambientReceivedNum;
    const chillUsed = (grandTotals.chilled || 0) - chillReceivedNum;

    setBaggedAmbient(ambient);
    setBaggedChill(chill);
    setUsedAmbient(ambientUsed);
    setUsedChill(chillUsed);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        receivedAmbient,
        receivedChill,
        currentAmbient,
        currentChill,
        baggedAmbient: ambient,
        baggedChill: chill,
        usedAmbient: ambientUsed,
        usedChill: chillUsed,
      },
      { merge: true }
    );

    showToast("Bagged Totes Saved");
  };

  const clearBaggedTotes = async () => {
    setReceivedAmbient("");
    setReceivedChill("");
    setCurrentAmbient("");
    setCurrentChill("");
    setBaggedAmbient(null);
    setBaggedChill(null);
    setUsedAmbient(0);
    setUsedChill(0);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        receivedAmbient: "",
        receivedChill: "",
        currentAmbient: "",
        currentChill: "",
        baggedAmbient: null,
        baggedChill: null,
        usedAmbient: 0,
        usedChill: 0,
      },
      { merge: true }
    );

    showToast("Bagged Totes Cleared");
  };

  const calculateCurrentBagged = async () => {
    const amb =
      (parseInt(currentAmbient2, 10) || 0) -
      ((parseInt(neededAmbient, 10) || 0) + (parseInt(leavingAmbient, 10) || 0));

    const chl =
      (parseInt(currentChill2, 10) || 0) -
      ((parseInt(neededChill, 10) || 0) + (parseInt(leavingChill, 10) || 0));

    setResultAmbient(amb);
    setResultChill(chl);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        currentAmbient2,
        currentChill2,
        neededAmbient,
        neededChill,
        leavingAmbient,
        leavingChill,
        resultAmbient: amb,
        resultChill: chl,
      },
      { merge: true }
    );

    showToast("Current Bagged Totes Saved");
  };

  const clearCurrentBagged = async () => {
    setCurrentAmbient2("");
    setCurrentChill2("");
    setNeededAmbient("");
    setNeededChill("");
    setLeavingAmbient("");
    setLeavingChill("");
    setResultAmbient(null);
    setResultChill(null);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        currentAmbient2: "",
        currentChill2: "",
        neededAmbient: "",
        neededChill: "",
        leavingAmbient: "",
        leavingChill: "",
        resultAmbient: null,
        resultChill: null,
      },
      { merge: true }
    );

    showToast("Current Bagged Totes Cleared");
  };

  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "center",
  };

  return (
    <section className="data-card bagged-card">
      <h2 className="data-title">Bagged Totes</h2>

      <div className="bagged-two-column">
        <div className="bagged-panel subcard">
          <h3>Bagged Totes</h3>

          <div className="bagged-fields">
            <div className="bagged-row" style={rowStyle}>
              <span>Ambient Totes Used:</span>
              <span style={{ fontSize: 25, fontWeight: "bold" }}>{usedAmbient ?? 0}</span>
            </div>

            <div className="bagged-row" style={rowStyle}>
              <span>Chill Totes Used:</span>
              <span style={{ fontSize: 25, fontWeight: "bold" }}>{usedChill ?? 0}</span>
            </div>

            <div className="bagged-row" style={rowStyle}>
              <span>Ambient Totes Recieved:</span>
              <input
                type="number"
                value={receivedAmbient}
                onChange={(e) => setReceivedAmbient(e.target.value)}
              />
            </div>

            <div className="bagged-row" style={rowStyle}>
              <span>Chill Totes Recieved:</span>
              <input
                type="number"
                value={receivedChill}
                onChange={(e) => setReceivedChill(e.target.value)}
              />
            </div>

            <div className="bagged-row" style={rowStyle}>
              <span>Current totes ambient:</span>
              <input
                type="number"
                value={currentAmbient}
                onChange={(e) => setCurrentAmbient(e.target.value)}
              />
            </div>

            <div className="bagged-row" style={rowStyle}>
              <span>Current totes chill:</span>
              <input
                type="number"
                value={currentChill}
                onChange={(e) => setCurrentChill(e.target.value)}
              />
            </div>
          </div>

          <div className="center-buttons">
            <button className="calculate-btn" onClick={calculateBaggedTotes}>
              Calculate & Save
            </button>
            <button className="clear-btn" onClick={clearBaggedTotes}>
              Clear
            </button>
          </div>

          {baggedAmbient !== null && (
            <div className="bagged-result" style={{ marginTop: "20px" }}>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: "18px" }}>
                <span>Bagged Ambient:</span>
                <span style={{ marginLeft: "8px" }}>{baggedAmbient}</span>
              </div>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: "18px" }}>
                <span>Bagged Chill:</span>
                <span style={{ marginLeft: "8px" }}>{baggedChill}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bagged-panel subcard">
          <h3>Current Bagged Totes</h3>

          <div className="bagged-fields">
            {[
              { label: "Current totes ambient:", value: currentAmbient2, setter: setCurrentAmbient2 },
              { label: "Current totes chill:", value: currentChill2, setter: setCurrentChill2 },
              { label: "Totes needed ambient:", value: neededAmbient, setter: setNeededAmbient },
              { label: "Totes needed chill:", value: neededChill, setter: setNeededChill },
              { label: "Totes leaving for other shift ambient:", value: leavingAmbient, setter: setLeavingAmbient },
              { label: "Totes leaving for other shift chill:", value: leavingChill, setter: setLeavingChill },
            ].map((f, i) => (
              <div key={i} className="bagged-row" style={rowStyle}>
                <span>{f.label}</span>
                <input
                  type="number"
                  value={f.value}
                  onChange={(e) => f.setter(e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="center-buttons">
            <button className="calculate-btn" onClick={calculateCurrentBagged}>
              Calculate & Save
            </button>
            <button className="clear-btn" onClick={clearCurrentBagged}>
              Clear
            </button>
          </div>

          {resultAmbient !== null && (
            <div className="bagged-result" style={{ marginTop: "20px" }}>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: "18px" }}>
                <span>Ambient Behind / Ahead:</span>
                <span style={{ marginLeft: "8px" }}>{resultAmbient}</span>
              </div>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: "18px" }}>
                <span>Chill Behind / Ahead:</span>
                <span style={{ marginLeft: "8px" }}>{resultChill}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}