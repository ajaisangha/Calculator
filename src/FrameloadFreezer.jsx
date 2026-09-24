import React, { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";
import "./frameloadfreezer.css";

const FREEZER_DOC = doc(db, "totes", "freezerCalc");

export default function FrameloadFreezer({ grandTotals }) {
  const totalTotesValue = Number(grandTotals?.total ?? 0);

  const [activeFreezerMethod, setActiveFreezerMethod] = useState("uph");
  const [activeFrameloadMethod, setActiveFrameloadMethod] = useState("totes");

  const [pickersUPH, setPickersUPH] = useState("");
  const [uph, setUPH] = useState("");
  const [outstandingUPH, setOutstandingUPH] = useState("");
  const [breakUPH, setBreakUPH] = useState("");
  const [resultUPH, setResultUPH] = useState("-");

  const [pickersTrolly, setPickersTrolly] = useState("");
  const [trollyRate, setTrollyRate] = useState("");
  const [outstandingTrolly, setOutstandingTrolly] = useState("");
  const [breakTrolly, setBreakTrolly] = useState("");
  const [resultTrolly, setResultTrolly] = useState("-");

  const [totesLoaded, setTotesLoaded] = useState("");
  const [totesLoadedPerHour, setTotesLoadedPerHour] = useState("");
  const [totesBreak, setTotesBreak] = useState("");
  const [totesRemaining, setTotesRemaining] = useState("");
  const [totesResult, setTotesResult] = useState("-");

  const [dolliesRemaining, setDolliesRemaining] = useState("");
  const [dolliesPerHour, setDolliesPerHour] = useState("");
  const [dolliesBreak, setDolliesBreak] = useState("");
  const [dolliesResult, setDolliesResult] = useState("-");

  const [toast, setToast] = useState({ show: false, message: "" });
  const toastTimerRef = useRef(null);

  const showToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ show: true, message });

    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: "" });
      toastTimerRef.current = null;
    }, 1800);
  };

  const resetFreezerState = () => {
    setActiveFreezerMethod("uph");
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
  };

  const resetFrameloadState = () => {
    setActiveFrameloadMethod("totes");
    setTotesLoaded("");
    setTotesLoadedPerHour("");
    setTotesBreak("");
    setTotesRemaining("");
    setTotesResult("-");

    setDolliesRemaining("");
    setDolliesPerHour("");
    setDolliesBreak("");
    setDolliesResult("-");
  };

  const resetAllLocalState = () => {
    resetFrameloadState();
    resetFreezerState();
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(FREEZER_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        resetAllLocalState();
        return;
      }

      const data = snapshot.data() || {};

      setActiveFreezerMethod(data.activeFreezerMethod || "uph");
      setActiveFrameloadMethod(data.activeFrameloadMethod || "totes");

      setPickersUPH(data.pickersUPH || "");
      setUPH(data.uph || "");
      setOutstandingUPH(data.outstandingUPH || "");
      setBreakUPH(data.breakUPH || "");
      setResultUPH(data.resultUPH || "-");

      setPickersTrolly(data.pickersTrolly || "");
      setTrollyRate(data.trollyRate || "");
      setOutstandingTrolly(data.outstandingTrolly || "");
      setBreakTrolly(data.breakTrolly || "");
      setResultTrolly(data.resultTrolly || "-");

      setTotesLoaded(data.totesLoaded || "");
      setTotesLoadedPerHour(data.totesLoadedPerHour || "");
      setTotesBreak(data.totesBreak || "");
      setTotesRemaining(data.totesRemaining || "");
      setTotesResult(data.totesResult || "-");

      setDolliesRemaining(data.dolliesRemaining || "");
      setDolliesPerHour(data.dolliesPerHour || "");
      setDolliesBreak(data.dolliesBreak || "");
      setDolliesResult(data.dolliesResult || "-");
    });

    const handleClearAll = () => {
      resetAllLocalState();
    };

    window.addEventListener("shift-planner-clear-all", handleClearAll);

    return () => {
      unsubscribe();
      window.removeEventListener("shift-planner-clear-all", handleClearAll);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const saveViewState = async (nextState) => {
    await setDoc(FREEZER_DOC, nextState, { merge: true });
  };

  const calculateFinishTime = (hours, breakMinutes) => {
    if (!Number.isFinite(hours) || hours < 0) return "-";

    const now = new Date();
    const breakHours = (parseFloat(breakMinutes) || 0) / 60;
    const finish = new Date(now.getTime() + (hours + breakHours) * 3600000);

    let hour = finish.getHours();
    const minute = finish.getMinutes().toString().padStart(2, "0");
    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12 || 12;

    return `${hour}:${minute} ${ampm}`;
  };

  useEffect(() => {
    const totalRate = (parseFloat(pickersUPH) || 0) * (parseFloat(uph) || 0);

    if (!totalRate) {
      setResultUPH("-");
      return;
    }

    const hours = (parseFloat(outstandingUPH) || 0) / totalRate;
    setResultUPH(calculateFinishTime(hours, breakUPH));
  }, [pickersUPH, uph, outstandingUPH, breakUPH]);

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

  useEffect(() => {
    const loaded = parseFloat(totesLoaded) || 0;
    const rate = parseFloat(totesLoadedPerHour) || 0;
    const remaining = Math.max(totalTotesValue - loaded, 0);

    setTotesRemaining(String(remaining));

    if (remaining === 0 && totalTotesValue > 0) {
      setTotesResult(calculateFinishTime(0, totesBreak));
      return;
    }

    if (!rate || remaining <= 0) {
      setTotesResult("-");
      return;
    }

    setTotesResult(calculateFinishTime(remaining / rate, totesBreak));
  }, [totalTotesValue, totesLoaded, totesLoadedPerHour, totesBreak]);

  useEffect(() => {
    const remaining = parseFloat(dolliesRemaining) || 0;
    const rate = parseFloat(dolliesPerHour) || 0;

    if (remaining === 0 && dolliesRemaining !== "") {
      setDolliesResult(calculateFinishTime(0, dolliesBreak));
      return;
    }

    if (!rate || remaining <= 0) {
      setDolliesResult("-");
      return;
    }

    setDolliesResult(calculateFinishTime(remaining / rate, dolliesBreak));
  }, [dolliesRemaining, dolliesPerHour, dolliesBreak]);

  const saveUPH = async () => {
    await setDoc(
      FREEZER_DOC,
      { pickersUPH, uph, outstandingUPH, breakUPH, resultUPH },
      { merge: true }
    );
    showToast("UPH Table Saved");
  };

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

  const saveTotes = async () => {
    await setDoc(
      FREEZER_DOC,
      {
        totesLoaded,
        totesLoadedPerHour,
        totesBreak,
        totesRemaining,
        totesResult,
      },
      { merge: true }
    );
    showToast("Totes Table Saved");
  };

  const clearTotes = async () => {
    setTotesLoaded("");
    setTotesLoadedPerHour("");
    setTotesBreak("");
    setTotesRemaining("");
    setTotesResult("-");

    await setDoc(
      FREEZER_DOC,
      {
        totesLoaded: "",
        totesLoadedPerHour: "",
        totesBreak: "",
        totesRemaining: "",
        totesResult: "",
      },
      { merge: true }
    );

    showToast("Totes Table Cleared");
  };

  const saveDollies = async () => {
    await setDoc(
      FREEZER_DOC,
      {
        dolliesRemaining,
        dolliesPerHour,
        dolliesBreak,
        dolliesResult,
      },
      { merge: true }
    );
    showToast("Dolly Table Saved");
  };

  const clearDollies = async () => {
    setDolliesRemaining("");
    setDolliesPerHour("");
    setDolliesBreak("");
    setDolliesResult("-");

    await setDoc(
      FREEZER_DOC,
      {
        dolliesRemaining: "",
        dolliesPerHour: "",
        dolliesBreak: "",
        dolliesResult: "",
      },
      { merge: true }
    );

    showToast("Dolly Table Cleared");
  };

  const clearFrameloadAll = async () => {
    resetFrameloadState();

    await setDoc(
      FREEZER_DOC,
      {
        activeFrameloadMethod: "totes",
        totesLoaded: "",
        totesLoadedPerHour: "",
        totesBreak: "",
        totesRemaining: "",
        totesResult: "",
        dolliesRemaining: "",
        dolliesPerHour: "",
        dolliesBreak: "",
        dolliesResult: "",
      },
      { merge: true }
    );

    showToast("Frameload Cleared");
  };

  const clearFreezerAll = async () => {
    resetFreezerState();

    await setDoc(
      FREEZER_DOC,
      {
        activeFreezerMethod: "uph",
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
      },
      { merge: true }
    );

    showToast("Freezer Cleared");
  };

  return (
    <section className="data-card freezer-card">
      <h2 className="data-title">Freezer / Frameload</h2>

      <div className="sub-card compact-sub-card">
        <div className="sub-card-header">
          <h3>Frameload</h3>
          <button
            className="clear-btn subcard-clear-all-btn"
            onClick={clearFrameloadAll}
          >
            Clear All
          </button>
        </div>

        <div className="freezer-method-toggle freezer-sub-toggle">
          <label
            className={`freezer-radio-option ${
              activeFrameloadMethod === "totes" ? "active" : ""
            }`}
          >
            <input
              type="radio"
              name="frameloadMethod"
              value="totes"
              checked={activeFrameloadMethod === "totes"}
              onChange={async () => {
                setActiveFrameloadMethod("totes");
                await saveViewState({ activeFrameloadMethod: "totes" });
              }}
            />
            <span>Totes</span>
          </label>

          <label
            className={`freezer-radio-option ${
              activeFrameloadMethod === "dolly" ? "active" : ""
            }`}
          >
            <input
              type="radio"
              name="frameloadMethod"
              value="dolly"
              checked={activeFrameloadMethod === "dolly"}
              onChange={async () => {
                setActiveFrameloadMethod("dolly");
                await saveViewState({ activeFrameloadMethod: "dolly" });
              }}
            />
            <span>Dolly</span>
          </label>
        </div>

        {activeFrameloadMethod === "totes" && (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Total Totes</th>
                <th>Loaded</th>
                <th>Totes/hr</th>
                <th>Remaining</th>
                <th>Break</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: "bold" }}>{totalTotesValue}</td>
                <td><input type="number" value={totesLoaded} onChange={(event) => setTotesLoaded(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={totesLoadedPerHour} onChange={(event) => setTotesLoadedPerHour(event.target.value)} className="tiny-input" /></td>
                <td style={{ fontWeight: "bold" }}>{totesRemaining || "0"}</td>
                <td><input type="number" value={totesBreak} onChange={(event) => setTotesBreak(event.target.value)} className="tiny-input" /></td>
                <td style={{ fontWeight: "bold" }}>{totesResult || "-"}</td>
              </tr>
            </tbody>
          </table>
        )}

        {activeFrameloadMethod === "dolly" && (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Dollies Remaining</th>
                <th>Dollies/hr</th>
                <th>Break</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="number" value={dolliesRemaining} onChange={(event) => setDolliesRemaining(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={dolliesPerHour} onChange={(event) => setDolliesPerHour(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={dolliesBreak} onChange={(event) => setDolliesBreak(event.target.value)} className="tiny-input" /></td>
                <td style={{ fontWeight: "bold" }}>{dolliesResult || "-"}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="button-row-centered compact-buttons">
          {activeFrameloadMethod === "totes" ? (
            <>
              <button className="calculate-btn" onClick={saveTotes}>Save</button>
              <button className="clear-btn" onClick={clearTotes}>Clear</button>
            </>
          ) : (
            <>
              <button className="calculate-btn" onClick={saveDollies}>Save</button>
              <button className="clear-btn" onClick={clearDollies}>Clear</button>
            </>
          )}
        </div>
      </div>

      <div className="sub-card compact-sub-card">
        <div className="sub-card-header">
          <h3>Freezer</h3>
          <button
            className="clear-btn subcard-clear-all-btn"
            onClick={clearFreezerAll}
          >
            Clear All
          </button>
        </div>

        <div className="freezer-method-toggle freezer-sub-toggle">
          <label
            className={`freezer-radio-option ${
              activeFreezerMethod === "uph" ? "active" : ""
            }`}
          >
            <input
              type="radio"
              name="freezerMethod"
              value="uph"
              checked={activeFreezerMethod === "uph"}
              onChange={async () => {
                setActiveFreezerMethod("uph");
                await saveViewState({ activeFreezerMethod: "uph" });
              }}
            />
            <span>UPH Method</span>
          </label>

          <label
            className={`freezer-radio-option ${
              activeFreezerMethod === "trolly" ? "active" : ""
            }`}
          >
            <input
              type="radio"
              name="freezerMethod"
              value="trolly"
              checked={activeFreezerMethod === "trolly"}
              onChange={async () => {
                setActiveFreezerMethod("trolly");
                await saveViewState({ activeFreezerMethod: "trolly" });
              }}
            />
            <span>Trolly Method</span>
          </label>
        </div>

        {activeFreezerMethod === "uph" && (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Pickers</th>
                <th>UPH</th>
                <th>Outstanding</th>
                <th>Break</th>
                <th>Finish Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="number" value={pickersUPH} onChange={(event) => setPickersUPH(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={uph} onChange={(event) => setUPH(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={outstandingUPH} onChange={(event) => setOutstandingUPH(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={breakUPH} onChange={(event) => setBreakUPH(event.target.value)} className="tiny-input" /></td>
                <td style={{ fontWeight: "bold" }}>{resultUPH || "-"}</td>
              </tr>
            </tbody>
          </table>
        )}

        {activeFreezerMethod === "trolly" && (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Pickers</th>
                <th>Trolly/hr</th>
                <th>Outstanding</th>
                <th>Break</th>
                <th>Finish Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="number" value={pickersTrolly} onChange={(event) => setPickersTrolly(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={trollyRate} onChange={(event) => setTrollyRate(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={outstandingTrolly} onChange={(event) => setOutstandingTrolly(event.target.value)} className="tiny-input" /></td>
                <td><input type="number" value={breakTrolly} onChange={(event) => setBreakTrolly(event.target.value)} className="tiny-input" /></td>
                <td style={{ fontWeight: "bold" }}>{resultTrolly || "-"}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="button-row-centered compact-buttons">
          {activeFreezerMethod === "uph" ? (
            <>
              <button className="calculate-btn" onClick={saveUPH}>Save</button>
              <button className="clear-btn" onClick={clearUPH}>Clear</button>
            </>
          ) : (
            <>
              <button className="calculate-btn" onClick={saveTrolly}>Save</button>
              <button className="clear-btn" onClick={clearTrolly}>Clear</button>
            </>
          )}
        </div>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}
