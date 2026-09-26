import React, { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";
import "./ShiftEOS.css";

const SHIFT_EOS_DOC = doc(db, "totes", "shiftEOS");

const makeInitialShiftData = () => [
  { department: "IC", present: "0", absent: "0", vto: "0", ot: "0" },
  { department: "Pick", present: "0", absent: "0", vto: "0", ot: "0" },
  { department: "Freezer", present: "0", absent: "0", vto: "0", ot: "0" },
  { department: "Dispatch", present: "0", absent: "0", vto: "0", ot: "0" },
  { department: "Inbound", present: "0", absent: "0", vto: "0", ot: "0" },
  { department: "Coordinator", present: "0", absent: "0", vto: "0", ot: "0" },
];

export default function ShiftEOSCard() {
  const [shiftData, setShiftData] = useState(makeInitialShiftData);
  const [ambInbound, setAmbInbound] = useState("0");
  const [chillInbound, setChillInbound] = useState("0");
  const [freezerInbound, setFreezerInbound] = useState("0");
  const [outstandingPick, setOutstandingPick] = useState("6");
  const [ambientPick, setAmbientPick] = useState("0");
  const [chillPick, setChillPick] = useState("0");
  const [freezerPick, setFreezerPick] = useState("0");
  const [targetProd, setTargetProd] = useState("285");
  const [toast, setToast] = useState({ show: false, message: "" });
  const toastTimerRef = useRef(null);

  const showToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: "" });
      toastTimerRef.current = null;
    }, 2000);
  };

  const resetAllLocalState = () => {
    setShiftData(makeInitialShiftData());
    setAmbInbound("0");
    setChillInbound("0");
    setFreezerInbound("0");
    setOutstandingPick("0");
    setAmbientPick("0");
    setChillPick("0");
    setFreezerPick("0");
    setTargetProd("285");
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ show: false, message: "" });
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(SHIFT_EOS_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        resetAllLocalState();
        return;
      }

      const data = snapshot.data() || {};
      if (Object.keys(data).length === 0) {
        resetAllLocalState();
        return;
      }

      if (Array.isArray(data.shiftData)) {
        setShiftData(
          data.shiftData.map((row) => ({
            department: row.department,
            present: String(row.present ?? 0),
            absent: String(row.absent ?? 0),
            vto: String(row.vto ?? 0),
            ot: String(row.ot ?? 0),
          }))
        );
      } else {
        setShiftData(makeInitialShiftData());
      }

      setAmbInbound(String(data.ambInbound ?? 0));
      setChillInbound(String(data.chillInbound ?? 0));
      setFreezerInbound(String(data.freezerInbound ?? 0));
      setOutstandingPick(String(data.outstandingPick ?? 0));
      setAmbientPick(String(data.ambientPick ?? 0));
      setChillPick(String(data.chillPick ?? 0));
      setFreezerPick(String(data.freezerPick ?? 0));
      setTargetProd(String(data.targetProd ?? 285));
    });

    const handleClearAll = () => resetAllLocalState();
    window.addEventListener("shift-planner-clear-all", handleClearAll);

    return () => {
      unsubscribe();
      window.removeEventListener("shift-planner-clear-all", handleClearAll);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleShiftChange = (index, field, value) => {
    setShiftData((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const totalPresent = shiftData.reduce((sum, row) => sum + (parseInt(row.present, 10) || 0), 0);
  const totalAbsent = shiftData.reduce((sum, row) => sum + (parseInt(row.absent, 10) || 0), 0);
  const totalVTO = shiftData.reduce((sum, row) => sum + (parseFloat(row.vto) || 0), 0);
  const totalOT = shiftData.reduce((sum, row) => sum + (parseFloat(row.ot) || 0), 0);
  const totalHours = totalPresent * 10 + totalOT - totalVTO;

  const inbound =
    (parseFloat(ambInbound) || 0) +
    (parseFloat(chillInbound) || 0) +
    (parseFloat(freezerInbound) || 0) -
    (parseFloat(outstandingPick) || 0);
  const outbound =
    (parseFloat(ambientPick) || 0) +
    (parseFloat(chillPick) || 0) +
    (parseFloat(freezerPick) || 0);
  const totalIO = inbound + outbound;
  const actualProductivity = totalHours > 0 ? (totalIO / totalHours) * 1.13 : 0;
  const target = parseFloat(targetProd) || 0;
  const difference = actualProductivity - target;
  const inboundNeeded = target > 0 ? (target / 1.13) * totalHours - totalIO : 0;
  const vtoNeeded = target > 0 ? totalHours - (totalIO * 1.13) / target : 0;
  const productivityClass =
    actualProductivity < 270 ? "prod-red" : actualProductivity < 285 ? "prod-orange" : "prod-green";
  const targetClass = "prod-green";

  const saveShiftStaffing = async () => {
    const numericRows = shiftData.map((row) => ({
      department: row.department,
      present: parseInt(row.present, 10) || 0,
      absent: parseInt(row.absent, 10) || 0,
      vto: parseFloat(row.vto) || 0,
      ot: parseFloat(row.ot) || 0,
    }));
    const savedTotalHours = numericRows.reduce(
      (sum, row) => sum + row.present * 10 + row.ot - row.vto,
      0
    );

    try {
      await setDoc(
        SHIFT_EOS_DOC,
        { shiftData: numericRows, totalHours: savedTotalHours },
        { merge: true }
      );
      showToast("Hours Saved");
    } catch (error) {
      console.error("Save hours error:", error);
      showToast("Could not save hours");
    }
  };

  const saveInboundOutbound = async () => {
    try {
      await setDoc(
        SHIFT_EOS_DOC,
        {
          ambInbound: parseFloat(ambInbound) || 0,
          chillInbound: parseFloat(chillInbound) || 0,
          freezerInbound: parseFloat(freezerInbound) || 0,
          outstandingPick: parseFloat(outstandingPick) || 0,
          ambientPick: parseFloat(ambientPick) || 0,
          chillPick: parseFloat(chillPick) || 0,
          freezerPick: parseFloat(freezerPick) || 0,
          targetProd: parseFloat(targetProd) || 0,
        },
        { merge: true }
      );
      showToast("Shift EOS Saved");
    } catch (error) {
      console.error("Save Shift EOS error:", error);
      showToast("Could not save Shift EOS");
    }
  };

  const clearShiftStaffing = async () => {
    setShiftData(makeInitialShiftData());
    try {
      await setDoc(
        SHIFT_EOS_DOC,
        { shiftData: makeInitialShiftData(), totalHours: 0 },
        { merge: true }
      );
    } catch (error) {
      console.error("Clear hours error:", error);
      showToast("Could not clear hours");
    }
  };

  const clearInboundOutbound = async () => {
    setAmbInbound("0");
    setChillInbound("0");
    setFreezerInbound("0");
    setOutstandingPick("0");
    setAmbientPick("0");
    setChillPick("0");
    setFreezerPick("0");
    setTargetProd("285");

    try {
      await setDoc(
        SHIFT_EOS_DOC,
        {
          ambInbound: 0,
          chillInbound: 0,
          freezerInbound: 0,
          outstandingPick: 0,
          ambientPick: 0,
          chillPick: 0,
          freezerPick: 0,
          targetProd: 285,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Clear Shift EOS error:", error);
      showToast("Could not clear Shift EOS");
    }
  };

  return (
    <section className="data-card shift-eos-card" style={{ position: "relative" }}>
      <h2 className="data-title">Shift EOS Calculator</h2>

      <div className="shift-eos-flex">
        <div className="shift-subcard">
          <h3 className="subcard-title">Hours</h3>
          <div className="table-container">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Department</th><th>Present</th><th>Absent</th>
                  <th>VTO Hours</th><th>OT Hours</th>
                </tr>
              </thead>
              <tbody>
                {shiftData.map((row, index) => (
                  <tr key={row.department}>
                    <td>{row.department}</td>
                    <td><input type="number" value={row.present} onChange={(event) => handleShiftChange(index, "present", event.target.value)} className="tiny-input" /></td>
                    <td><input type="number" value={row.absent} onChange={(event) => handleShiftChange(index, "absent", event.target.value)} className="tiny-input" /></td>
                    <td><input type="number" step="0.01" value={row.vto} onChange={(event) => handleShiftChange(index, "vto", event.target.value)} className="tiny-input" /></td>
                    <td><input type="number" step="0.01" value={row.ot} onChange={(event) => handleShiftChange(index, "ot", event.target.value)} className="tiny-input" /></td>
                  </tr>
                ))}
                <tr className="bold">
                  <td>Total</td><td>{totalPresent}</td><td>{totalAbsent}</td>
                  <td>{totalVTO.toFixed(2)}</td><td>{totalOT.toFixed(2)}</td>
                </tr>
                <tr className="bold">
                  <td>Total Hours</td><td>{totalHours.toFixed(2)}</td><td colSpan="3"></td>
                </tr>
              </tbody>
            </table>
            <div className="button-row-centered">
              <button className="calculate-btn" onClick={saveShiftStaffing}>Save Hours</button>
              <button className="clear-btn" onClick={clearShiftStaffing}>Clear Hours</button>
            </div>
          </div>
        </div>

        <div className="shift-subcard">
          <h3 className="subcard-title">Shift EOS</h3>
          <div className="table-container">
            <table className="data-table compact-table">
              <tbody>
                <tr>
                  <td>Ambient Pick</td>
                  <td><input type="number" value={ambientPick} onChange={(event) => setAmbientPick(event.target.value)} className="tiny-input" /></td>
                  <td>Ambient Inbound</td>
                  <td><input type="number" value={ambInbound} onChange={(event) => setAmbInbound(event.target.value)} className="tiny-input" /></td>
                </tr>
                <tr>
                  <td>Chill Pick</td>
                  <td><input type="number" value={chillPick} onChange={(event) => setChillPick(event.target.value)} className="tiny-input" /></td>
                  <td>Chill Inbound</td>
                  <td><input type="number" value={chillInbound} onChange={(event) => setChillInbound(event.target.value)} className="tiny-input" /></td>
                </tr>
                <tr>
                  <td>Freezer Pick</td>
                  <td><input type="number" value={freezerPick} onChange={(event) => setFreezerPick(event.target.value)} className="tiny-input" /></td>
                  <td>Freezer Inbound</td>
                  <td><input type="number" value={freezerInbound} onChange={(event) => setFreezerInbound(event.target.value)} className="tiny-input" /></td>
                </tr>
                <tr className="bold">
                  <td>Total Outbound</td><td>{outbound.toFixed(2)}</td>
                  <td>Total Inbound</td><td>{inbound.toFixed(2)}</td>
                </tr>
                <tr className="bold">
                  <td>Inbound + Outbound</td><td>{totalIO.toFixed(2)}</td>
                  <td>Inbound Needed</td><td>{Math.round(inboundNeeded).toString()}</td>
                </tr>
                <tr className="bold">
                  <td>Total Hours</td><td>{totalHours.toFixed(2)}</td>
                  <td>VTO Needed</td><td>{vtoNeeded.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className={targetClass}>Target Productivity</td>
                  <td className={targetClass}><input type="number" value={targetProd} onChange={(event) => setTargetProd(event.target.value)} className="tiny-input" /></td>
                  <td className={productivityClass}>Actual Productivity</td>
                  <td className={productivityClass} style={{ fontWeight: "bold" }}>{actualProductivity.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Outstanding Picks @ 6AM</td>
                  <td><input type="number" value={outstandingPick} onChange={(event) => setOutstandingPick(event.target.value)} className="tiny-input" /></td>
                  <td>Difference</td><td style={{ fontWeight: "bold" }}>{difference.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <div className="button-row-centered">
              <button className="calculate-btn" onClick={saveInboundOutbound}>Save Shift EOS</button>
              <button className="clear-btn" onClick={clearInboundOutbound}>Clear Shift EOS</button>
            </div>
          </div>
        </div>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}
