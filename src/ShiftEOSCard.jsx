import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";

const SHIFT_EOS_DOC = doc(db, "totes", "shiftEOS");

export default function ShiftEOSCard() {
  // --- Initial Shift Table Data ---
  const initialShiftData = [
    { department: "IC", present: 0, absent: 0, vto: 0, ot: 0 },
    { department: "pick", present: 0, absent: 0, vto: 0, ot: 0 },
    { department: "freezer", present: 0, absent: 0, vto: 0, ot: 0 },
    { department: "dispatch", present: 0, absent: 0, vto: 0, ot: 0 },
    { department: "inbound", present: 0, absent: 0, vto: 0, ot: 0 },
    { department: "coordinator", present: 0, absent: 0, vto: 0, ot: 0 },
  ];

  const [shiftData, setShiftData] = useState(initialShiftData);

  // --- Productivity Inputs ---
  const [ambInbound, setAmbInbound] = useState(0);
  const [chillInbound, setChillInbound] = useState(0);
  const [freezerInbound, setFreezerInbound] = useState(0);
  const [outstandingPick, setOutstandingPick] = useState(6);
  const [ambientPick, setAmbientPick] = useState(0);
  const [chillPick, setChillPick] = useState(0);
  const [freezerPick, setFreezerPick] = useState(0);

  // --- Load Firestore Data ---
  useEffect(() => {
    const unsubscribe = onSnapshot(SHIFT_EOS_DOC, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shiftData) setShiftData(data.shiftData);
        setAmbInbound(data.ambInbound || 0);
        setChillInbound(data.chillInbound || 0);
        setFreezerInbound(data.freezerInbound || 0);
        setOutstandingPick(data.outstandingPick || 0);
        setAmbientPick(data.ambientPick || 0);
        setChillPick(data.chillPick || 0);
        setFreezerPick(data.freezerPick || 0);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Handlers ---
  const handleShiftChange = (idx, field, value) => {
    const updated = [...shiftData];
    if (field === "present" || field === "absent") {
      updated[idx][field] = parseInt(value) || 0;
    } else {
      updated[idx][field] = parseFloat(value) || 0;
    }
    setShiftData(updated);
  };

  // --- Calculations ---
  const totalVTO = shiftData.reduce((sum, row) => sum + row.vto, 0);
  const totalOT = shiftData.reduce((sum, row) => sum + row.ot, 0);
  const totalPresent = shiftData.reduce((sum, row) => sum + row.present, 0);
  const totalAbsent = shiftData.reduce((sum, row) => sum + row.absent, 0);
  const totalHours = totalPresent * 10 + totalOT - totalVTO;

  const inbound = ambInbound + chillInbound + freezerInbound - outstandingPick;
  const outbound = ambientPick + chillPick + freezerPick;
  const totalPickInboundOutbound = inbound + outbound;
  const actualProductivity = totalHours > 0 ? (totalPickInboundOutbound / totalHours) * 1.13 : 0;
  const target = 260;
  const difference = actualProductivity - target;
  const inboundNeeded = target > 0 ? (target / 1.13) * totalHours - totalPickInboundOutbound : 0;
  const hoursNeedsToReduce = totalPickInboundOutbound > 0 ? totalHours - (totalPickInboundOutbound * 1.13) / target : 0;

  // --- Firestore Actions ---
  const saveShiftEOS = async () => {
    await setDoc(SHIFT_EOS_DOC, {
      shiftData,
      ambInbound,
      chillInbound,
      freezerInbound,
      outstandingPick,
      ambientPick,
      chillPick,
      freezerPick,
    }, { merge: true });
  };

  const clearShiftEOS = async () => {
    setShiftData(initialShiftData);
    setAmbInbound(0);
    setChillInbound(0);
    setFreezerInbound(0);
    setOutstandingPick(0);
    setAmbientPick(0);
    setChillPick(0);
    setFreezerPick(0);

    await setDoc(SHIFT_EOS_DOC, {
      shiftData: initialShiftData,
      ambInbound: 0,
      chillInbound: 0,
      freezerInbound: 0,
      outstandingPick: 0,
      ambientPick: 0,
      chillPick: 0,
      freezerPick: 0,
    }, { merge: true });
  };

  return (
    <section className="data-card shift-eos-card">
      <h2 className="data-title">Shift EOS Calculator</h2>

      <div className="shift-eos-flex">

        {/* -------- SHIFT TABLE -------- */}
        <div className="shift-subcard">
          <h3 className="subcard-title">Shift Staffing</h3>
          <div className="table-container">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>VTO</th>
                  <th>OT</th>
                </tr>
              </thead>
              <tbody>
                {shiftData.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.department}</td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        value={row.present}
                        onChange={(e) => handleShiftChange(idx, "present", e.target.value)}
                        className="tiny-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        value={row.absent}
                        onChange={(e) => handleShiftChange(idx, "absent", e.target.value)}
                        className="tiny-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.vto}
                        onChange={(e) => handleShiftChange(idx, "vto", e.target.value)}
                        className="tiny-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.ot}
                        onChange={(e) => handleShiftChange(idx, "ot", e.target.value)}
                        className="tiny-input"
                      />
                    </td>
                  </tr>
                ))}

                {/* Totals */}
                <tr className="bold">
                  <td>Total</td>
                  <td>{totalPresent}</td>
                  <td>{totalAbsent}</td>
                  <td>{totalVTO.toFixed(2)}</td>
                  <td>{totalOT.toFixed(2)}</td>
                </tr>

                <tr className="bold">
                  <td>Total Hours</td>
                  <td>{totalHours.toFixed(2)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* -------- PRODUCTIVITY -------- */}
        <div className="shift-subcard">
          <h3 className="subcard-title">Inbound / Outbound</h3>
          <div className="table-container">
            <table className="data-table compact-table">
              <tbody>
                <tr>
                  <td>Ambient Pick</td>
                  <td><input type="number" value={ambientPick} onChange={(e) => setAmbientPick(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                  <td>Ambient Inbound</td>
                  <td><input type="number" value={ambInbound} onChange={(e) => setAmbInbound(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                </tr>
                <tr>
                  <td>Chill Pick</td>
                  <td><input type="number" value={chillPick} onChange={(e) => setChillPick(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                  <td>Chill Inbound</td>
                  <td><input type="number" value={chillInbound} onChange={(e) => setChillInbound(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                </tr>
                <tr>
                  <td>Freezer Pick</td>
                  <td><input type="number" value={freezerPick} onChange={(e) => setFreezerPick(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                  <td>Freezer Inbound</td>
                  <td><input type="number" value={freezerInbound} onChange={(e) => setFreezerInbound(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                </tr>

                <tr className="bold">
                  <td>Total Outbound</td>
                  <td>{outbound.toFixed(2)}</td>
                  <td>Total Inbound</td>
                  <td>{inbound.toFixed(2)}</td>
                </tr>

                <tr>
                  <td>Outstanding Picks @ 6AM</td>
                  <td><input type="number" value={outstandingPick} onChange={(e) => setOutstandingPick(parseFloat(e.target.value) || 0)} className="tiny-input"/></td>
                  <td></td>
                  <td></td>
                </tr>

                <tr className="bold">
                  <td>Inbound + Outbound</td>
                  <td>{totalPickInboundOutbound.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Hours</td>
                  <td>{totalHours.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Actual Productivity</td>
                  <td>{actualProductivity.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Target Productivity</td>
                  <td>{target}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Difference</td>
                  <td>{difference.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Inbound Needed</td>
                  <td>{inboundNeeded.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>VTO Needed</td>
                  <td>{hoursNeedsToReduce.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>

            {/* --- Buttons --- */}
            <div style={{ marginTop: 8 }}>
              <button className="calculate-btn" onClick={saveShiftEOS}>Save Shift EOS</button>
              <button className="clear-btn" onClick={clearShiftEOS}>Clear Shift EOS</button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
