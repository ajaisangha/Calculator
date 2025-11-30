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

  // --- NEW: Break (min) for FIRST TABLE ---
  const [ambientBreak1, setAmbientBreak1] = useState("");
  const [chillBreak1, setChillBreak1] = useState("");

  // --- Required Pickers Calculator ---
  const [reqAmbientUPH, setReqAmbientUPH] = useState("");
  const [reqChillUPH, setReqChillUPH] = useState("");

  const [reqAmbientOutstanding, setReqAmbientOutstanding] = useState("");
  const [reqChillOutstanding, setReqChillOutstanding] = useState("");

  const [reqAmbientFinish, setReqAmbientFinish] = useState("");
  const [reqChillFinish, setReqChillFinish] = useState("");

  const [reqAmbientBreak, setReqAmbientBreak] = useState("");
  const [reqChillBreak, setReqChillBreak] = useState("");

  const [reqAmbientResult, setReqAmbientResult] = useState(null);
  const [reqChillResult, setReqChillResult] = useState(null);

  // --- Toast ---
  const [toast, setToast] = useState({ show: false, message: "" });
  const showToast = (m) => {
    setToast({ show: true, message: m });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  // --- Load Firestore ---
  useEffect(() => {
    const unsub = onSnapshot(PICK_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      // Main pick table
      setAmbientPickers(d.ambientPickers || "");
      setChillPickers(d.chillPickers || "");
      setAmbientUPH(d.ambientUPH || "");
      setChillUPH(d.chillUPH || "");
      setAmbientOutstanding(d.ambientOutstanding || "");
      setChillOutstanding(d.chillOutstanding || "");

      // NEW LOAD BREAK 1
      setAmbientBreak1(d.ambientBreak1 || "");
      setChillBreak1(d.chillBreak1 || "");

      // Required pickers table
      setReqAmbientUPH(d.reqAmbientUPH || "");
      setReqChillUPH(d.reqChillUPH || "");
      setReqAmbientOutstanding(d.reqAmbientOutstanding || "");
      setReqChillOutstanding(d.reqChillOutstanding || "");
      setReqAmbientFinish(d.reqAmbientFinish || "");
      setReqChillFinish(d.reqChillFinish || "");
      setReqAmbientBreak(d.reqAmbientBreak || "");
      setReqChillBreak(d.reqChillBreak || "");
      setReqAmbientResult(d.reqAmbientResult ?? null);
      setReqChillResult(d.reqChillResult ?? null);
    });

    return () => unsub();
  }, []);

  // --- Helpers ---
  const projected = (uph, pickers) =>
    (parseFloat(uph) || 0) * (parseFloat(pickers) || 0);

  // --- Updated finishing time: includes BREAK ---
  const finishingTime = (outstanding, proj, breakMinutes) => {
    if (!proj || proj <= 0) return "-";

    const now = new Date();
    const hoursNeeded = outstanding / proj;

    let finish = new Date(now.getTime() + hoursNeeded * 3600000);

    // Add break minutes to finishing time
    const extraMs = ((parseFloat(breakMinutes) || 0) * 60000);
    finish = new Date(finish.getTime() + extraMs);

    let h = finish.getHours();
    let m = finish.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${h}:${m} ${ampm}`;
  };

  // --- Hours Remaining (for required pickers) ---
  const getHoursRemaining = (finishTime, breakMinutes) => {
    if (!finishTime) return 0;
    const now = new Date();
    const [hh, mm] = finishTime.split(":").map(Number);

    let finish = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);

    if (finish <= now) finish.setDate(finish.getDate() + 1);

    let hours = (finish - now) / 3600000;
    const breakHours = (parseFloat(breakMinutes) || 0) / 60;

    hours -= breakHours;
    if (hours < 0) hours = 0;

    return hours;
  };

  // --- Save Main Pick Calc ---
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
        ambientBreak1,
        chillBreak1
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
    setAmbientBreak1("");
    setChillBreak1("");

    await setDoc(
      PICK_DOC,
      {
        ambientPickers: "",
        chillPickers: "",
        ambientUPH: "",
        chillUPH: "",
        ambientOutstanding: "",
        chillOutstanding: "",
        ambientBreak1: "",
        chillBreak1: ""
      },
      { merge: true }
    );
  };

  // --- Required Pickers ---
  const calculateRequiredPickers = async () => {
    const ambHours = getHoursRemaining(reqAmbientFinish, reqAmbientBreak);
    const chlHours = getHoursRemaining(reqChillFinish, reqChillBreak);

    const ambReq =
      ambHours > 0
        ? Math.ceil(
            (parseFloat(reqAmbientOutstanding) || 0) /
              (ambHours * (parseFloat(reqAmbientUPH) || 1))
          )
        : 0;

    const chlReq =
      chlHours > 0
        ? Math.ceil(
            (parseFloat(reqChillOutstanding) || 0) /
              (chlHours * (parseFloat(reqChillUPH) || 1))
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
        reqAmbientBreak,
        reqChillBreak,
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
    setReqAmbientBreak("");
    setReqChillBreak("");
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
        reqAmbientBreak: "",
        reqChillBreak: "",
        reqAmbientResult: null,
        reqChillResult: null,
      },
      { merge: true }
    );
  };

  // --- Computed Values (Now include break1) ---
  const ambProjected = projected(ambientUPH, ambientPickers);
  const chlProjected = projected(chillUPH, chillPickers);

  const ambFinish = finishingTime(
    parseFloat(ambientOutstanding) || 0,
    ambProjected,
    ambientBreak1
  );

  const chlFinish = finishingTime(
    parseFloat(chillOutstanding) || 0,
    chlProjected,
    chillBreak1
  );

  return (
  <section className="data-card pick-card" style={{ position: "relative" }}>
    <h2 className="data-title">Pick Calculator</h2>

    {/* MAIN PICK CALCULATOR */}
    <div className="table-container" style={{ marginTop: 24 }}>
      <table className="data-table pick-table spaced-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Pickers</th>
            <th>UPH</th>
            <th>Outstanding</th>
            <th>Break (min)</th>
            <th>Projected Hourly Picks</th>
            <th>Finishing At</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Ambient</td>
            <td><input type="number" value={ambientPickers} onChange={(e)=>setAmbientPickers(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={ambientUPH} onChange={(e)=>setAmbientUPH(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={ambientOutstanding} onChange={(e)=>setAmbientOutstanding(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={ambientBreak1} onChange={(e)=>setAmbientBreak1(e.target.value)} className="break-input" /></td>
            <td>{ambProjected}</td>
            <td>{ambFinish}</td>
          </tr>

          <tr>
            <td>Chill</td>
            <td><input type="number" value={chillPickers} onChange={(e)=>setChillPickers(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={chillUPH} onChange={(e)=>setChillUPH(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={chillOutstanding} onChange={(e)=>setChillOutstanding(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={chillBreak1} onChange={(e)=>setChillBreak1(e.target.value)} className="break-input" /></td>
            <td>{chlProjected}</td>
            <td>{chlFinish}</td>
          </tr>
        </tbody>
      </table>

      {/* CENTERED BUTTONS */}
      <div className="center-buttons">
        <button className="calculate-btn" onClick={savePickCalc}>Save</button>
        <button className="clear-btn" onClick={clearPickCalc}>Clear</button>
      </div>
    </div>

    {/* REQUIRED PICKERS TABLE */}
    <h3 style={{ marginTop: 40 }}>Required Pickers Calculator</h3>

    <div className="table-container" style={{ marginTop: 10 }}>
      <table className="data-table pick-table spaced-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>UPH</th>
            <th>Outstanding</th>
            <th>Finish By</th>
            <th>Break (min)</th>
            <th>Pickers Required</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Ambient</td>
            <td><input type="number" value={reqAmbientUPH} onChange={(e)=>setReqAmbientUPH(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={reqAmbientOutstanding} onChange={(e)=>setReqAmbientOutstanding(e.target.value)} className="pick-input" /></td>
            <td><input type="time" value={reqAmbientFinish} onChange={(e)=>setReqAmbientFinish(e.target.value)} className="time-input" /></td>
            <td><input type="number" value={reqAmbientBreak} onChange={(e)=>setReqAmbientBreak(e.target.value)} className="break-input" /></td>
            <td>{reqAmbientResult ?? "-"}</td>
          </tr>

          <tr>
            <td>Chill</td>
            <td><input type="number" value={reqChillUPH} onChange={(e)=>setReqChillUPH(e.target.value)} className="pick-input" /></td>
            <td><input type="number" value={reqChillOutstanding} onChange={(e)=>setReqChillOutstanding(e.target.value)} className="pick-input" /></td>
            <td><input type="time" value={reqChillFinish} onChange={(e)=>setReqChillFinish(e.target.value)} className="time-input" /></td>
            <td><input type="number" value={reqChillBreak} onChange={(e)=>setReqChillBreak(e.target.value)} className="break-input" /></td>
            <td>{reqChillResult ?? "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* CENTERED BUTTONS */}
      <div className="center-buttons">
        <button className="calculate-btn" onClick={calculateRequiredPickers}>Calculate</button>
        <button className="clear-btn" onClick={clearRequiredPickers}>Clear</button>
      </div>
    </div>

    {toast.show && <div className="toast-notification-center">{toast.message}</div>}
  </section>
);

}
