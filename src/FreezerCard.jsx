import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";
import "./freezer.css";

const FREEZER_DOC = doc(db, "totes", "freezerCalc");

export default function FreezerCard() {
  const [activeMethod, setActiveMethod] = useState("uph");

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

  // -----------------------------
  // STATE — TABLE 3 (Ishant method)
  // -----------------------------
  const [ishantPickers, setIshantPickers] = useState("");
  const [ishantTrolliesLeft, setIshantTrolliesLeft] = useState("");
  const [ishantPicksLeft, setIshantPicksLeft] = useState("");
  const [ishantPicksPerHour, setIshantPicksPerHour] = useState("");
  const [ishantBreak, setIshantBreak] = useState("");
  const [ishantUPH, setIshantUPH] = useState("");
  const [ishantPicksDoneTime, setIshantPicksDoneTime] = useState("");
  const [ishantTrolleyDoneTime, setIshantTrolleyDoneTime] = useState("");

  // Toast
  const [toast, setToast] = useState({ show: false, message: "" });
  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  // -----------------------------
  // LOAD FIRESTORE
  // -----------------------------
  useEffect(() => {
    const unsub = onSnapshot(FREEZER_DOC, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};

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

      setIshantPickers(d.ishantPickers || "");
      setIshantTrolliesLeft(d.ishantTrolliesLeft || "");
      setIshantPicksLeft(d.ishantPicksLeft || "");
      setIshantPicksPerHour(d.ishantPicksPerHour || "");
      setIshantBreak(d.ishantBreak || "");
      setIshantUPH(d.ishantUPH || "");
      setIshantPicksDoneTime(d.ishantPicksDoneTime || "");
      setIshantTrolleyDoneTime(d.ishantTrolleyDoneTime || "");
    });

    return () => unsub();
  }, []);

  const formatTimeFromNow = (hoursToAdd, breakMinutes = 0) => {
    if (!Number.isFinite(hoursToAdd) || hoursToAdd < 0) return "-";

    const now = new Date();
    const totalMs = (hoursToAdd * 60 + (parseFloat(breakMinutes) || 0)) * 60000;
    const finish = new Date(now.getTime() + totalMs);

    let hh = finish.getHours();
    const mm = finish.getMinutes().toString().padStart(2, "0");
    const ampm = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;

    return `${hh}:${mm} ${ampm}`;
  };

  // ----------------------------------------------------
  // Convert hours → formatted time
  // ----------------------------------------------------
  const calculateFinishTime = (hours, breakMinutes) => {
    if (!hours || hours <= 0 || !Number.isFinite(hours)) return "-";

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

  const resetAllTablesState = () => {
    setPickersUPH("");
    setUPH("");
    setOutstandingUPH("");
    setBreakUPH("");
    setResultUPH("-");

    setPickersTrolly("");
    setTrollyRate("");
    setOutstandingTrolly("");
    setBreakTrolly("");
    setResultTrolly("-");

    setIshantPickers("");
    setIshantTrolliesLeft("");
    setIshantPicksLeft("");
    setIshantPicksPerHour("");
    setIshantBreak("");
    setIshantUPH("");
    setIshantPicksDoneTime("-");
    setIshantTrolleyDoneTime("-");
  };

  // ----------------------------------------------------
  // AUTO-CALCULATE (UPH TABLE)
  // ----------------------------------------------------
  useEffect(() => {
    const totalRate = (parseFloat(pickersUPH) || 0) * (parseFloat(uph) || 0);
    if (!totalRate) {
      setResultUPH("-");
      return;
    }

    const hours = (parseFloat(outstandingUPH) || 0) / totalRate;
    setResultUPH(calculateFinishTime(hours, breakUPH));
  }, [pickersUPH, uph, outstandingUPH, breakUPH]);

  // ----------------------------------------------------
  // AUTO-CALCULATE (TROLLEY TABLE)
  // ----------------------------------------------------
  useEffect(() => {
    const totalRate =
      (parseFloat(pickersTrolly) || 0) * (parseFloat(trollyRate) || 0);
    if (!totalRate) {
      setResultTrolly("-");
      return;
    }

    const hours = (parseFloat(outstandingTrolly) || 0) / totalRate;
    setResultTrolly(calculateFinishTime(hours, breakTrolly));
  }, [pickersTrolly, trollyRate, outstandingTrolly, breakTrolly]);

  // ----------------------------------------------------
  // AUTO-CALCULATE (ISHANT TABLE)
  // ----------------------------------------------------
  useEffect(() => {
    const pickers = parseFloat(ishantPickers) || 0;
    const trolliesLeft = parseFloat(ishantTrolliesLeft) || 0;
    const picksLeft = parseFloat(ishantPicksLeft) || 0;
    const picksPerHour = parseFloat(ishantPicksPerHour) || 0;
    const breakMinutes = parseFloat(ishantBreak) || 0;

    if (pickers > 0 && picksPerHour > 0) {
      setIshantUPH((picksPerHour / pickers).toFixed(2));
    } else {
      setIshantUPH("");
    }

    if (picksLeft > 0 && picksPerHour > 0) {
      const picksHours = picksLeft / picksPerHour;
      setIshantPicksDoneTime(formatTimeFromNow(picksHours, breakMinutes));
    } else {
      setIshantPicksDoneTime("-");
    }

    if (trolliesLeft > 0 && pickers > 0) {
      const trolleyDivisor = picksPerHour >= 1000 ? 1.25 : 1.5;
      const trolleyHours = (trolliesLeft / trolleyDivisor) / pickers;
      setIshantTrolleyDoneTime(formatTimeFromNow(trolleyHours, breakMinutes));
    } else {
      setIshantTrolleyDoneTime("-");
    }
  }, [
    ishantPickers,
    ishantTrolliesLeft,
    ishantPicksLeft,
    ishantPicksPerHour,
    ishantBreak,
  ]);

  // ----------------------------------------------------
  // SAVE TABLE 1 ONLY
  // ----------------------------------------------------
  const saveUPH = async () => {
    await setDoc(
      FREEZER_DOC,
      {
        pickersUPH,
        uph,
        outstandingUPH,
        breakUPH,
        resultUPH,
      },
      { merge: true }
    );

    showToast("UPH Table Saved");
  };

  // ----------------------------------------------------
  // CLEAR TABLE 1 ONLY
  // ----------------------------------------------------
  const clearUPH = async () => {
    setPickersUPH("");
    setUPH("");
    setOutstandingUPH("");
    setBreakUPH("");
    setResultUPH("-");

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

    showToast("UPH Table Cleared");
  };

  // ----------------------------------------------------
  // SAVE TABLE 2 ONLY
  // ----------------------------------------------------
  const saveTrolly = async () => {
    await setDoc(
      FREEZER_DOC,
      {
        pickersTrolly,
        trollyRate,
        outstandingTrolly,
        breakTrolly,
        resultTrolly,
      },
      { merge: true }
    );

    showToast("Trolly Table Saved");
  };

  // ----------------------------------------------------
  // CLEAR TABLE 2 ONLY
  // ----------------------------------------------------
  const clearTrolly = async () => {
    setPickersTrolly("");
    setTrollyRate("");
    setOutstandingTrolly("");
    setBreakTrolly("");
    setResultTrolly("-");

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

    showToast("Trolly Table Cleared");
  };

  // ----------------------------------------------------
  // SAVE TABLE 3 ONLY
  // ----------------------------------------------------
  const saveIshant = async () => {
    await setDoc(
      FREEZER_DOC,
      {
        ishantPickers,
        ishantTrolliesLeft,
        ishantPicksLeft,
        ishantPicksPerHour,
        ishantBreak,
        ishantUPH,
        ishantPicksDoneTime,
        ishantTrolleyDoneTime,
      },
      { merge: true }
    );

    showToast("Ishant Method Saved");
  };

  // ----------------------------------------------------
  // CLEAR TABLE 3 ONLY
  // ----------------------------------------------------
  const clearIshant = async () => {
    setIshantPickers("");
    setIshantTrolliesLeft("");
    setIshantPicksLeft("");
    setIshantPicksPerHour("");
    setIshantBreak("");
    setIshantUPH("");
    setIshantPicksDoneTime("-");
    setIshantTrolleyDoneTime("-");

    await setDoc(
      FREEZER_DOC,
      {
        ishantPickers: "",
        ishantTrolliesLeft: "",
        ishantPicksLeft: "",
        ishantPicksPerHour: "",
        ishantBreak: "",
        ishantUPH: "",
        ishantPicksDoneTime: "",
        ishantTrolleyDoneTime: "",
      },
      { merge: true }
    );

    showToast("Ishant Method Cleared");
  };

  // ----------------------------------------------------
  // CLEAR ALL TABLES
  // ----------------------------------------------------
  const clearAllTables = async () => {
    resetAllTablesState();

    await setDoc(
      FREEZER_DOC,
      {
        pickersUPH: "",
        uph: "",
        outstandingUPH: "",
        breakUPH: "",
        resultUPH: "",
        pickersTrolly: "",
        trollyRate: "",
        outstandingTrolly: "",
        breakTrolly: "",
        resultTrolly: "",
        ishantPickers: "",
        ishantTrolliesLeft: "",
        ishantPicksLeft: "",
        ishantPicksPerHour: "",
        ishantBreak: "",
        ishantUPH: "",
        ishantPicksDoneTime: "",
        ishantTrolleyDoneTime: "",
      },
      { merge: true }
    );

    showToast("All Freezer Tables Cleared");
  };

  return (
    <section className="data-card freezer-card">
      <h2 className="data-title">Freezer Calculator</h2>

      <div className="freezer-top-bar">
  <div className="freezer-method-toggle">
    <label className={`freezer-radio-option ${activeMethod === "uph" ? "active" : ""}`}>
      <input
        type="radio"
        name="freezerMethod"
        value="uph"
        checked={activeMethod === "uph"}
        onChange={() => setActiveMethod("uph")}
      />
      <span>UPH Method</span>
    </label>

    <label
      className={`freezer-radio-option ${activeMethod === "trolly" ? "active" : ""}`}
    >
      <input
        type="radio"
        name="freezerMethod"
        value="trolly"
        checked={activeMethod === "trolly"}
        onChange={() => setActiveMethod("trolly")}
      />
      <span>Trolly Method</span>
    </label>

    <label
      className={`freezer-radio-option ${activeMethod === "ishant" ? "active" : ""}`}
    >
      <input
        type="radio"
        name="freezerMethod"
        value="ishant"
        checked={activeMethod === "ishant"}
        onChange={() => setActiveMethod("ishant")}
      />
      <span>Ishant Method</span>
    </label>
  </div>

  <div className="freezer-clear-all-row">
    <button className="clear-btn freezer-clear-all-btn" onClick={clearAllTables}>
      Clear All
    </button>
  </div>
</div>

      {activeMethod === "uph" && (
        <div className="sub-card">
          <h3>Finish Time Using UPH</h3>

          <table className="data-table">
            <thead>
              <tr>
                <th>Pickers</th>
                <th>UPH</th>
                <th>Outstanding</th>
                <th>Break (min)</th>
                <th>Finish Time</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>
                  <input
                    type="number"
                    value={pickersUPH}
                    onChange={(e) => setPickersUPH(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={uph}
                    onChange={(e) => setUPH(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={outstandingUPH}
                    onChange={(e) => setOutstandingUPH(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={breakUPH}
                    onChange={(e) => setBreakUPH(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td style={{ fontWeight: "bold" }}>{resultUPH || "-"}</td>
              </tr>
            </tbody>
          </table>

          <div className="button-row-centered">
            <button className="calculate-btn" onClick={saveUPH}>
              Save
            </button>
            <button className="clear-btn" onClick={clearUPH}>
              Clear
            </button>
          </div>
        </div>
      )}

      {activeMethod === "trolly" && (
        <div className="sub-card">
          <h3>Finish Time Using Trollies</h3>

          <table className="data-table">
            <thead>
              <tr>
                <th>Pickers</th>
                <th>Trolly/hr</th>
                <th>Outstanding Trollies</th>
                <th>Break (min)</th>
                <th>Finish Time</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>
                  <input
                    type="number"
                    value={pickersTrolly}
                    onChange={(e) => setPickersTrolly(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={trollyRate}
                    onChange={(e) => setTrollyRate(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={outstandingTrolly}
                    onChange={(e) => setOutstandingTrolly(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={breakTrolly}
                    onChange={(e) => setBreakTrolly(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td style={{ fontWeight: "bold" }}>{resultTrolly || "-"}</td>
              </tr>
            </tbody>
          </table>

          <div className="button-row-centered">
            <button className="calculate-btn" onClick={saveTrolly}>
              Save
            </button>
            <button className="clear-btn" onClick={clearTrolly}>
              Clear
            </button>
          </div>
        </div>
      )}

      {activeMethod === "ishant" && (
        <div className="sub-card">
          <h3>Ishant Method</h3>

          <table className="data-table ishant-table">
            <thead>
              <tr>
                <th>Pickers</th>
                <th>Trollies Left</th>
                <th>Picks Left</th>
                <th>Picks/Hour</th>
                <th>Break (min)</th>
                <th>Resulted UPH</th>
                <th>Picks Done At</th>
                <th>Trollies Done At</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>
                  <input
                    type="number"
                    value={ishantPickers}
                    onChange={(e) => setIshantPickers(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={ishantTrolliesLeft}
                    onChange={(e) => setIshantTrolliesLeft(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={ishantPicksLeft}
                    onChange={(e) => setIshantPicksLeft(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={ishantPicksPerHour}
                    onChange={(e) => setIshantPicksPerHour(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={ishantBreak}
                    onChange={(e) => setIshantBreak(e.target.value)}
                    className="tiny-input"
                  />
                </td>
                <td style={{ fontWeight: "bold" }}>{ishantUPH || "-"}</td>
                <td style={{ fontWeight: "bold" }}>{ishantPicksDoneTime || "-"}</td>
                <td style={{ fontWeight: "bold" }}>{ishantTrolleyDoneTime || "-"}</td>
              </tr>
            </tbody>
          </table>

          <div className="button-row-centered">
            <button className="calculate-btn" onClick={saveIshant}>
              Save
            </button>
            <button className="clear-btn" onClick={clearIshant}>
              Clear
            </button>
          </div>
        </div>
      )}

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}