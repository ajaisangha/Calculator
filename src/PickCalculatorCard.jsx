import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./App";
import "./App.css";

const PICK_DOC = doc(db, "totes", "pickCalculator");

export default function PickCalculatorCard() {
  const [ambientPickers, setAmbientPickers] = useState("");
  const [chillPickers, setChillPickers] = useState("");
  const [ambientUPH, setAmbientUPH] = useState("");
  const [chillUPH, setChillUPH] = useState("");
  const [ambientOutstanding, setAmbientOutstanding] = useState("");
  const [chillOutstanding, setChillOutstanding] = useState("");

  // Load from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(PICK_DOC, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAmbientPickers(data.ambientPickers || "");
        setChillPickers(data.chillPickers || "");
        setAmbientUPH(data.ambientUPH || "");
        setChillUPH(data.chillUPH || "");
        setAmbientOutstanding(data.ambientOutstanding || "");
        setChillOutstanding(data.chillOutstanding || "");
      }
    });
    return () => unsubscribe();
  }, []);

  const saveData = async () => {
    await setDoc(PICK_DOC, { ambientPickers, chillPickers, ambientUPH, chillUPH, ambientOutstanding, chillOutstanding });
  };

  const clearAll = async () => {
    setAmbientPickers(""); setChillPickers(""); setAmbientUPH(""); setChillUPH(""); setAmbientOutstanding(""); setChillOutstanding("");
    try { await deleteDoc(PICK_DOC); } catch (err) { console.error(err); }
  };

  const calculateProjected = (uph, pickers) => (parseFloat(uph) || 0) * (parseFloat(pickers) || 0);

  const ambientProjected = calculateProjected(ambientUPH, ambientPickers);
  const chillProjected = calculateProjected(chillUPH, chillPickers);

  const calculateFinishTime = (outstanding, projected) => {
    if (!projected || projected === 0) return "-";
    const hoursNeeded = outstanding / projected;
    const now = new Date();
    const reference225 = 2*60+25, reference305=3*60+5;
    const currentMins = now.getHours()*60 + now.getMinutes();
    let baseTime = new Date(now);
    if (currentMins < reference225) baseTime.setMinutes(baseTime.getMinutes()+45);
    else if (currentMins>=reference225 && currentMins<reference305) baseTime.setHours(3,5,0,0);
    const finishTime = new Date(baseTime.getTime() + hoursNeeded*60*60*1000);
    const hours = finishTime.getHours(); const minutes = finishTime.getMinutes();
    const ampm = hours>=12?"PM":"AM"; const displayHours = hours%12===0?12:hours%12;
    const displayMinutes = minutes.toString().padStart(2,"0");
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const ambientFinish = calculateFinishTime(parseFloat(ambientOutstanding)||0, ambientProjected);
  const chillFinish = calculateFinishTime(parseFloat(chillOutstanding)||0, chillProjected);

  return (
    <section className="data-card pick-card">
      <h2 className="data-title">Pick Calculator</h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Pickers</th>
              <th>UPH</th>
              <th>Outstanding Picks</th>
              <th>Projected Hourly Picks</th>
              <th>Finishing At</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ambient</td>
              <td><input type="number" value={ambientPickers} onChange={e => setAmbientPickers(e.target.value)} onBlur={saveData} /></td>
              <td><input type="number" value={ambientUPH} onChange={e => setAmbientUPH(e.target.value)} onBlur={saveData} /></td>
              <td><input type="number" value={ambientOutstanding} onChange={e => setAmbientOutstanding(e.target.value)} onBlur={saveData} /></td>
              <td>{ambientProjected || 0}</td>
              <td>{ambientFinish}</td>
            </tr>
            <tr>
              <td>Chill</td>
              <td><input type="number" value={chillPickers} onChange={e => setChillPickers(e.target.value)} onBlur={saveData} /></td>
              <td><input type="number" value={chillUPH} onChange={e => setChillUPH(e.target.value)} onBlur={saveData} /></td>
              <td><input type="number" value={chillOutstanding} onChange={e => setChillOutstanding(e.target.value)} onBlur={saveData} /></td>
              <td>{chillProjected || 0}</td>
              <td>{chillFinish}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="button-row">
        <button onClick={clearAll} className="clear-btn">Clear</button>
      </div>
    </section>
  );
}
