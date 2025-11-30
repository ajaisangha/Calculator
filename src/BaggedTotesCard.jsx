import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import "./App.css";

const BAGGED_TOTES_DOC = doc(db, "totes", "baggedTotes");

export default function BaggedTotesCard({
  grandTotals,
  receivedAmbient, receivedChill,
  currentAmbient, currentChill,
  setReceivedAmbient, setReceivedChill,
  setCurrentAmbient, setCurrentChill
}) {

  // LEFT: Bagged Totes
  const [baggedAmbient, setBaggedAmbient] = useState(null);
  const [baggedChill, setBaggedChill] = useState(null);

  // RIGHT: Current bagged
  const [currentAmbient2, setCurrentAmbient2] = useState("");
  const [currentChill2, setCurrentChill2] = useState("");
  const [neededAmbient, setNeededAmbient] = useState("");
  const [neededChill, setNeededChill] = useState("");
  const [resultAmbient, setResultAmbient] = useState(null);
  const [resultChill, setResultChill] = useState(null);

  // Toast
  const [toast, setToast] = useState({ show:false, message:"" });
  const showToast = (msg) => {
    setToast({ show:true, message:msg });
    setTimeout(() => setToast({ show:false, message:"" }), 2000);
  };

  // ================================
  // 🔥 LOAD FROM FIRESTORE
  // ================================
  useEffect(() => {
    const unsub = onSnapshot(BAGGED_TOTES_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      // load left side
      setReceivedAmbient(d.receivedAmbient || "");
      setReceivedChill(d.receivedChill || "");
      setCurrentAmbient(d.currentAmbient || "");
      setCurrentChill(d.currentChill || "");
      setBaggedAmbient(d.baggedAmbient ?? null);
      setBaggedChill(d.baggedChill ?? null);

      // load right side
      setCurrentAmbient2(d.currentAmbient2 || "");
      setCurrentChill2(d.currentChill2 || "");
      setNeededAmbient(d.neededAmbient || "");
      setNeededChill(d.neededChill || "");
      setResultAmbient(d.resultAmbient ?? null);
      setResultChill(d.resultChill ?? null);
    });

    return () => unsub();
  }, []);

  // ================================
  // 🔥 SAVE LEFT SIDE
  // ================================
  const calculateBaggedTotes = async () => {
    const ambient =
      (grandTotals.ambient || 0) +
      (parseInt(currentAmbient,10)||0) -
      (parseInt(receivedAmbient,10)||0);

    const chill =
      (grandTotals.chilled || 0) +
      (parseInt(currentChill,10)||0) -
      (parseInt(receivedChill,10)||0);

    setBaggedAmbient(ambient);
    setBaggedChill(chill);

    // SAVE VALUES THAT COME FROM PROPS + RESULT
    await setDoc(
      BAGGED_TOTES_DOC,
      {
        receivedAmbient,
        receivedChill,
        currentAmbient,
        currentChill,
        baggedAmbient: ambient,
        baggedChill: chill
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

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        receivedAmbient: "",
        receivedChill: "",
        currentAmbient: "",
        currentChill: "",
        baggedAmbient: null,
        baggedChill: null
      },
      { merge: true }
    );

    showToast("Bagged Totes Cleared");
  };

  // ================================
  // 🔥 SAVE RIGHT SIDE
  // ================================
  const calculateCurrentBagged = async () => {
    const amb = (parseInt(currentAmbient2,10)||0) - (parseInt(neededAmbient,10)||0);
    const chl = (parseInt(currentChill2,10)||0) - (parseInt(neededChill,10)||0);

    setResultAmbient(amb);
    setResultChill(chl);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        currentAmbient2,
        currentChill2,
        neededAmbient,
        neededChill,
        resultAmbient: amb,
        resultChill: chl
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

    setResultAmbient(null);
    setResultChill(null);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        currentAmbient2: "",
        currentChill2: "",
        neededAmbient: "",
        neededChill: "",
        resultAmbient: null,
        resultChill: null
      },
      { merge: true }
    );

    showToast("Current Bagged Totes Cleared");
  };

  // ================================
  // RENDER UI
  // ================================

  return (
    <section className="data-card bagged-card">
      <h2 className="data-title">Bagged Totes</h2>

      <div style={{ display:"flex", gap:"32px", width:"100%" }}>
        
        {/* LEFT SIDE */}
        <div style={{ flex:1 }}>
          <h3>Bagged Totes</h3>

          <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
            {[
              { label:"Ambient totes received:", value:receivedAmbient, setter:setReceivedAmbient },
              { label:"Chill totes received:", value:receivedChill, setter:setReceivedChill },
              { label:"Current totes ambient:", value:currentAmbient, setter:setCurrentAmbient },
              { label:"Current totes chill:", value:currentChill, setter:setCurrentChill },
            ].map((f, i) => (
              <div key={i} className="bagged-row">
                <span>{f.label}</span>
                <input type="number" value={f.value} onChange={e => f.setter(e.target.value)} />
              </div>
            ))}
          </div>

          <div className="center-buttons">
            <button className="calculate-btn" onClick={calculateBaggedTotes}>Calculate & Save</button>
            <button className="clear-btn" onClick={clearBaggedTotes}>Clear</button>
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

        {/* RIGHT SIDE */}
        <div style={{ flex:1 }}>
          <h3>Current Bagged Totes</h3>

          <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
            {[
              { label:"Current totes ambient:", value:currentAmbient2, setter:setCurrentAmbient2 },
              { label:"Current totes chill:", value:currentChill2, setter:setCurrentChill2 },
              { label:"Totes needed ambient:", value:neededAmbient, setter:setNeededAmbient },
              { label:"Totes needed chill:", value:neededChill, setter:setNeededChill },
            ].map((f, i) => (
              <div key={i} className="bagged-row">
                <span>{f.label}</span>
                <input type="number" value={f.value} onChange={e => f.setter(e.target.value)} />
              </div>
            ))}
          </div>

          <div className="center-buttons">
            <button className="calculate-btn" onClick={calculateCurrentBagged}>Calculate & Save</button>
            <button className="clear-btn" onClick={clearCurrentBagged}>Clear</button>
          </div>

          {resultAmbient !== null && (
            <div className="bagged-result" style={{ marginTop: "20px" }}>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: "18px" }}>
                <span>Ambient After Pick:</span>
                <span style={{ marginLeft: "8px" }}>{resultAmbient}</span>
              </div>
              <div className="result-line" style={{ fontWeight: "bold", fontSize: "18px" }}>
                <span>Chill After Pick:</span>
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
