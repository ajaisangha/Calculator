import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import "./App.css";

const PICK_DOC = doc(db, "totes", "pickCalculator");

export default function PickAndBaggedCombinedCard() {
  // --- Main Pick Calculator State ---
  const [ambientPickers, setAmbientPickers] = useState("");
  const [chillPickers, setChillPickers] = useState("");
  const [ambientUPH, setAmbientUPH] = useState("");
  const [chillUPH, setChillUPH] = useState("");
  const [ambientOutstanding, setAmbientOutstanding] = useState("");
  const [chillOutstanding, setChillOutstanding] = useState("");

  // --- Required Pickers Section ---
  const [reqAmbientUPH, setReqAmbientUPH] = useState("");
  const [reqChillUPH, setReqChillUPH] = useState("");
  const [reqAmbientOutstanding, setReqAmbientOutstanding] = useState("");
  const [reqChillOutstanding, setReqChillOutstanding] = useState("");
  const [reqAmbientFinish, setReqAmbientFinish] = useState("");
  const [reqChillFinish, setReqChillFinish] = useState("");

  const [reqAmbientResult, setReqAmbientResult] = useState(null);
  const [reqChillResult, setReqChillResult] = useState(null);

  // --- Toast ---
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  // --- Load Data from Firestore ---
  useEffect(() => {
    const unsub = onSnapshot(PICK_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      // Main pick calculator
      setAmbientPickers(d.ambientPickers || "");
      setChillPickers(d.chillPickers || "");
      setAmbientUPH(d.ambientUPH || "");
      setChillUPH(d.chillUPH || "");
      setAmbientOutstanding(d.ambientOutstanding || "");
      setChillOutstanding(d.chillOutstanding || "");

      // Required pickers calculator
      setReqAmbientUPH(d.reqAmbientUPH || "");
      setReqChillUPH(d.reqChillUPH || "");
      setReqAmbientOutstanding(d.reqAmbientOutstanding || "");
      setReqChillOutstanding(d.reqChillOutstanding || "");
      setReqAmbientFinish(d.reqAmbientFinish || "");
      setReqChillFinish(d.reqChillFinish || "");
      setReqAmbientResult(d.reqAmbientResult ?? null);
      setReqChillResult(d.reqChillResult ?? null);
    });

    return () => unsub();
  }, []);

  // --- Helper Functions ---
  const projected = (uph, pickers) =>
    (parseFloat(uph) || 0) * (parseFloat(pickers) || 0);

  const finishingTime = (outstanding, proj) => {
    if (!proj || proj <= 0) return "-";

    const now = new Date();
    const hoursNeeded = outstanding / proj;
    const finish = new Date(now.getTime() + hoursNeeded * 3600000);

    let h = finish.getHours();
    let m = finish.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${h}:${m} ${ampm}`;
  };

  // --- Convert HH:MM (24h) to hours remaining ---
  const getHoursRemaining = (timeStr) => {
    if (!timeStr) return 0;

    const now = new Date();
    const [hh, mm] = timeStr.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return 0;

    const finish = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hh,
      mm
    );

    const diff = finish - now;
    if (diff <= 0) return 0;

    return diff / 3600000; // convert ms to hours
  };

  // --- Save Main Pick Calculator ---
  const savePickCalc = async () => {
    await setDoc(
      PICK_DOC,
      {
        ambientPickers,
        chillPickers,
        ambientUPH,
        chillUPH,
        ambientOutstanding,
        chillOutstanding,
      },
      { merge: true }
    );
    showToast("Pick Calculator Saved");
  };

  const clearPickCalc = async () => {
    setAmbientPickers("");
    setChillPickers("");
    setAmbientUPH("");
    setChillUPH("");
    setAmbientOutstanding("");
    setChillOutstanding("");

    await setDoc(
      PICK_DOC,
      {
        ambientPickers: "",
        chillPickers: "",
        ambientUPH: "",
        chillUPH: "",
        ambientOutstanding: "",
        chillOutstanding: "",
      },
      { merge: true }
    );
  };

  // --- Calculate Required Pickers ---
  const calculateRequiredPickers = async () => {
    const ambHours = getHoursRemaining(reqAmbientFinish);
    const chlHours = getHoursRemaining(reqChillFinish);

    const ambReq =
      ambHours > 0
        ? Math.round(
            (parseFloat(reqAmbientOutstanding) || 0) /
              ambHours /
              (parseFloat(reqAmbientUPH) || 1)
          )
        : 0;

    const chlReq =
      chlHours > 0
        ? Math.round(
            (parseFloat(reqChillOutstanding) || 0) /
              chlHours /
              (parseFloat(reqChillUPH) || 1)
          )
        : 0;

    setReqAmbientResult(ambReq);
    setReqChillResult(chlReq);

    await setDoc(
      PICK_DOC,
      {
        reqAmbientUPH,
        reqChillUPH,
        reqAmbientOutstanding,
        reqChillOutstanding,
        reqAmbientFinish,
        reqChillFinish,
        reqAmbientResult: ambReq,
        reqChillResult: chlReq,
      },
      { merge: true }
    );

    showToast("Required Pickers Calculated");
  };

  const clearRequiredPickers = async () => {
    setReqAmbientUPH("");
    setReqChillUPH("");
    setReqAmbientOutstanding("");
    setReqChillOutstanding("");
    setReqAmbientFinish("");
    setReqChillFinish("");
    setReqAmbientResult(null);
    setReqChillResult(null);

    await setDoc(
      PICK_DOC,
      {
        reqAmbientUPH: "",
        reqChillUPH: "",
        reqAmbientOutstanding: "",
        reqChillOutstanding: "",
        reqAmbientFinish: "",
        reqChillFinish: "",
        reqAmbientResult: null,
        reqChillResult: null,
      },
      { merge: true }
    );
  };

  // --- Projections ---
  const ambProjected = projected(ambientUPH, ambientPickers);
  const chlProjected = projected(chillUPH, chillPickers);

  const ambFinish = finishingTime(
    parseFloat(ambientOutstanding) || 0,
    ambProjected
  );
  const chlFinish = finishingTime(
    parseFloat(chillOutstanding) || 0,
    chlProjected
  );

  return (
    <section className="data-card pick-card" style={{ position: "relative" }}>
      <h2 className="data-title">Pick Calculator</h2>

      {/* MAIN PICK CALCULATOR */}
      <div className="table-container" style={{ marginTop: 24 }}>
        <table className="data-table pick-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Pickers</th>
              <th>UPH</th>
              <th>Outstanding</th>
              <th>Projected Hourly Picks</th>
              <th>Finishing At</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Ambient</td>
              <td><input type="number" value={ambientPickers} onChange={(e)=>setAmbientPickers(e.target.value)} className="picker-input"/></td>
              <td><input type="number" value={ambientUPH} onChange={(e)=>setAmbientUPH(e.target.value)} className="uph-input"/></td>
              <td><input type="number" value={ambientOutstanding} onChange={(e)=>setAmbientOutstanding(e.target.value)} className="outstanding-input"/></td>
              <td>{ambProjected}</td>
              <td>{ambFinish}</td>
            </tr>

            <tr>
              <td>Chill</td>
              <td><input type="number" value={chillPickers} onChange={(e)=>setChillPickers(e.target.value)} className="picker-input"/></td>
              <td><input type="number" value={chillUPH} onChange={(e)=>setChillUPH(e.target.value)} className="uph-input"/></td>
              <td><input type="number" value={chillOutstanding} onChange={(e)=>setChillOutstanding(e.target.value)} className="outstanding-input"/></td>
              <td>{chlProjected}</td>
              <td>{chlFinish}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 8, display:"flex", gap:8 }}>
          <button className="calculate-btn" onClick={savePickCalc}>Save</button>
          <button className="clear-btn" onClick={clearPickCalc}>Clear</button>
        </div>
      </div>

      {/* REQUIRED PICKERS CALCULATOR */}
      <h3 style={{ marginTop: 40 }}>Required Pickers Calculator</h3>

      <div className="table-container" style={{ marginTop: 10 }}>
        <table className="data-table pick-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>UPH</th>
              <th>Outstanding</th>
              <th>Finish By</th>
              <th>Pickers Required</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Ambient</td>
              <td><input type="number" value={reqAmbientUPH} onChange={(e)=>setReqAmbientUPH(e.target.value)} className="uph-input"/></td>
              <td><input type="number" value={reqAmbientOutstanding} onChange={(e)=>setReqAmbientOutstanding(e.target.value)} className="outstanding-input"/></td>
              <td><input type="time" value={reqAmbientFinish} onChange={(e)=>setReqAmbientFinish(e.target.value)} className="uph-input"/></td>
              <td>{reqAmbientResult !== null ? reqAmbientResult : "-"}</td>
            </tr>

            <tr>
              <td>Chill</td>
              <td><input type="number" value={reqChillUPH} onChange={(e)=>setReqChillUPH(e.target.value)} className="uph-input"/></td>
              <td><input type="number" value={reqChillOutstanding} onChange={(e)=>setReqChillOutstanding(e.target.value)} className="outstanding-input"/></td>
              <td><input type="time" value={reqChillFinish} onChange={(e)=>setReqChillFinish(e.target.value)} className="uph-input"/></td>
              <td>{reqChillResult !== null ? reqChillResult : "-"}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 8, display:"flex", gap:8 }}>
          <button className="calculate-btn" onClick={calculateRequiredPickers}>Calculate</button>
          <button className="clear-btn" onClick={clearRequiredPickers}>Clear</button>
        </div>
      </div>

      {/* Toast */}
      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}
