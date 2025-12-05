import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";

const FREEZER_DOC = doc(db, "totes", "freezerCalc");

export default function FreezerCard() {
  // -----------------------------
  // STATE — TABLE 1 (UPH method)
  // -----------------------------
  const [pickersUPH, setPickersUPH] = useState("");
  const [uph, setUPH] = useState("");
  const [outstandingUPH, setOutstandingUPH] = useState("");
  const [breakUPH, setBreakUPH] = useState("");
  const [resultUPH, setResultUPH] = useState("");

  // -----------------------------
  // STATE — TABLE 2 (Trolley method)
  // -----------------------------
  const [pickersTrolly, setPickersTrolly] = useState("");
  const [trollyRate, setTrollyRate] = useState("");
  const [outstandingTrolly, setOutstandingTrolly] = useState("");
  const [breakTrolly, setBreakTrolly] = useState("");
  const [resultTrolly, setResultTrolly] = useState("");

  // Toast
  const [toast, setToast] = useState({ show: false, message: "" });
  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  // -----------------------------
  // LOAD FIRESTORE DATA
  // -----------------------------
  useEffect(() => {
    const unsub = onSnapshot(FREEZER_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      setPickersUPH(d.pickersUPH || "");
      setUPH(d.uph || "");
      setOutstandingUPH(d.outstandingUPH || "");
      setBreakUPH(d.breakUPH || "");
      setResultUPH(d.resultUPH || "");

      setPickersTrolly(d.pickersTrolly || "");
      setTrollyRate(d.trollyRate || "");
      setOutstandingTrolly(d.outstandingTrolly || "");
      setBreakTrolly(d.breakTrolly || "");
      setResultTrolly(d.resultTrolly || "");
    });

    return () => unsub();
  }, []);

  // ----------------------------------------------------
  // TIME CONVERSION FUNCTION
  // hoursToTimeString(hours, breakMinutes)
  // ----------------------------------------------------
  const calculateFinishTime = (hours, breakMinutes) => {
    if (!hours || hours <= 0) return "-";

    const now = new Date();
    const breakHrs = (parseFloat(breakMinutes) || 0) / 60;

    const finalHours = hours + breakHrs;

    const finish = new Date(now.getTime() + finalHours * 3600000);

    let hh = finish.getHours();
    let mm = finish.getMinutes().toString().padStart(2, "0");
    const ampm = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;

    return `${hh}:${mm} ${ampm}`;
  };

  // -----------------------------
  // CALCULATE TABLE 1 (UPH)
  // -----------------------------
  const handleCalculateUPH = async () => {
    const hours =
      (parseFloat(outstandingUPH) || 0) /
      ((parseFloat(pickersUPH) || 0) * (parseFloat(uph) || 0));

    const time = calculateFinishTime(hours, breakUPH);
    setResultUPH(time);

    await setDoc(
      FREEZER_DOC,
      {
        pickersUPH,
        uph,
        outstandingUPH,
        breakUPH,
        resultUPH: time,
      },
      { merge: true }
    );

    showToast("UPH Calculation Saved");
  };

  const clearUPH = async () => {
    setPickersUPH("");
    setUPH("");
    setOutstandingUPH("");
    setBreakUPH("");
    setResultUPH("");

    await setDoc(
      FREEZER_DOC,
      {
        pickersUPH: "",
        uph: "",
        outstandingUPH: "",
        breakUPH: "",
        resultUPH: "",
      },
      { merge: true }
    );
  };

  // -----------------------------
  // CALCULATE TABLE 2 (Trolley)
  // -----------------------------
  const handleCalculateTrolly = async () => {
    const hours =
      (parseFloat(outstandingTrolly) || 0) /
      ((parseFloat(pickersTrolly) || 0) * (parseFloat(trollyRate) || 0));

    const time = calculateFinishTime(hours, breakTrolly);
    setResultTrolly(time);

    await setDoc(
      FREEZER_DOC,
      {
        pickersTrolly,
        trollyRate,
        outstandingTrolly,
        breakTrolly,
        resultTrolly: time,
      },
      { merge: true }
    );

    showToast("Trolley Calculation Saved");
  };

  const clearTrolly = async () => {
    setPickersTrolly("");
    setTrollyRate("");
    setOutstandingTrolly("");
    setBreakTrolly("");
    setResultTrolly("");

    await setDoc(
      FREEZER_DOC,
      {
        pickersTrolly: "",
        trollyRate: "",
        outstandingTrolly: "",
        breakTrolly: "",
        resultTrolly: "",
      },
      { merge: true }
    );
  };

  return (
    <section className="data-card" style={{ paddingBottom: 30 }}>
      <h2 className="data-title">Freezer Calculator</h2>

      {/* ======================= TABLE 1 - UPH METHOD ======================= */}
      <h3 style={{ marginTop: 20 }}>Finish Time Using UPH</h3>

      <table className="data-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Pickers</th>
            <th>UPH</th>
            <th>Outstanding Picks</th>
            <th>Break (min)</th>
            <th>Finishing Time</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td><input type="number" value={pickersUPH} onChange={(e)=>setPickersUPH(e.target.value)} className="tiny-input"/></td>
            <td><input type="number" value={uph} onChange={(e)=>setUPH(e.target.value)} className="tiny-input"/></td>
            <td><input type="number" value={outstandingUPH} onChange={(e)=>setOutstandingUPH(e.target.value)} className="tiny-input"/></td>
            <td><input type="number" value={breakUPH} onChange={(e)=>setBreakUPH(e.target.value)} className="tiny-input"/></td>
            <td style={{ fontWeight:"bold" }}>{resultUPH || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* Buttons Centered */}
      <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:12 }}>
        <button className="calculate-btn" onClick={handleCalculateUPH}>Save</button>
        <button className="clear-btn" onClick={clearUPH}>Clear</button>
      </div>

      {/* ======================= TABLE 2 - TROLLEY METHOD ======================= */}
      <h3 style={{ marginTop: 40 }}>Finish Time Using Trollies</h3>

      <table className="data-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Pickers</th>
            <th>Trolly/hr</th>
            <th>Outstanding Trollies</th>
            <th>Break (min)</th>
            <th>Finishing Time</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td><input type="number" value={pickersTrolly} onChange={(e)=>setPickersTrolly(e.target.value)} className="tiny-input"/></td>
            <td><input type="number" value={trollyRate} onChange={(e)=>setTrollyRate(e.target.value)} className="tiny-input"/></td>
            <td><input type="number" value={outstandingTrolly} onChange={(e)=>setOutstandingTrolly(e.target.value)} className="tiny-input"/></td>
            <td><input type="number" value={breakTrolly} onChange={(e)=>setBreakTrolly(e.target.value)} className="tiny-input"/></td>
            <td style={{ fontWeight:"bold" }}>{resultTrolly || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* Buttons Centered */}
      <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:12 }}>
        <button className="calculate-btn" onClick={handleCalculateTrolly}>Save</button>
        <button className="clear-btn" onClick={clearTrolly}>Clear</button>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}
