import React, { useState } from "react";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import "./App.css";

const BAGGED_TOTES_DOC = doc(db, "totes", "baggedTotes");

export default function BaggedTotesCard({
  grandTotals,
  receivedAmbient, receivedChill,
  currentAmbient, currentChill,
  setReceivedAmbient, setReceivedChill,
  setCurrentAmbient, setCurrentChill
}) {
  const [baggedAmbient, setBaggedAmbient] = useState(null);
  const [baggedChill, setBaggedChill] = useState(null);
  const [totalBagged, setTotalBagged] = useState(null);
  const [toast, setToast] = useState({ show:false, message:"" });

  // -------------------------
  // Calculate Bagged Totes
  // -------------------------
  const calculateBaggedTotes = async () => {
    const ambient = (grandTotals.ambient || 0) + (parseInt(currentAmbient,10)||0) - (parseInt(receivedAmbient,10)||0);
    const chill   = (grandTotals.chilled || 0) + (parseInt(currentChill,10)||0) - (parseInt(receivedChill,10)||0);
    const total   = ambient + chill;

    setBaggedAmbient(ambient);
    setBaggedChill(chill);
    setTotalBagged(total);

    await setDoc(BAGGED_TOTES_DOC, {
      receivedAmbient, receivedChill,
      currentAmbient, currentChill,
      baggedAmbient: ambient,
      baggedChill: chill,
      totalBagged: total
    }, { merge:true });

    setToast({ show:true, message:"Bagged Totes Saved" });
    setTimeout(() => setToast({ show:false, message:"" }), 2000);
  };

  const clearBaggedTotes = async () => {
    setReceivedAmbient("");
    setReceivedChill("");
    setCurrentAmbient("");
    setCurrentChill("");
    setBaggedAmbient(null);
    setBaggedChill(null);
    setTotalBagged(null);

    await setDoc(BAGGED_TOTES_DOC, {
      receivedAmbient:"", receivedChill:"",
      currentAmbient:"", currentChill:"",
      baggedAmbient:null, baggedChill:null, totalBagged:null
    }, { merge:true });
  };

  return (
    <section className="data-card bagged-card">
      <h2 className="data-title">Bagged Totes</h2>

      <div className="bagged-fields">
        {[
          { label:"Ambient totes received:", value: receivedAmbient, setter:setReceivedAmbient },
          { label:"Chill totes received:", value: receivedChill, setter:setReceivedChill },
          { label:"Current totes in hive bagged ambient:", value: currentAmbient, setter:setCurrentAmbient },
          { label:"Current totes in hive bagged chill:", value: currentChill, setter:setCurrentChill }
        ].map((f,i)=>(
          <div key={i} className="bagged-row">
            <span>{f.label}</span>
            <input type="number" value={f.value} onChange={e=>f.setter(e.target.value)} />
          </div>
        ))}
      </div>

      <div style={{ marginTop:8, display:"flex", gap:8 }}>
        <button className="calculate-btn" onClick={calculateBaggedTotes}>Calculate & Save Bagged Totes</button>
        <button className="clear-btn" onClick={clearBaggedTotes}>Clear Bagged Totes</button>
      </div>

      {baggedAmbient !== null && baggedChill !== null && (
        <div className="bagged-result">
          <div className="result-line"><span>Bagged Ambient Totes:</span> <span>{baggedAmbient}</span></div>
          <div className="result-line"><span>Bagged Chill Totes:</span> <span>{baggedChill}</span></div>
          <div className="result-line"><span>Total Bagged Totes:</span> <span>{totalBagged}</span></div>
        </div>
      )}

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}
