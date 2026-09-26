import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import "./staffallocation.css";

const SHIFT_DOC = doc(db, "totes", "shiftEOS");
const PICK_DOC = doc(db, "totes", "pickCalculator");
const FREEZER_DOC = doc(db, "totes", "freezerCalc");
const BAGGED_DOC = doc(db, "totes", "baggedTotes");
const STAFF_DOC = doc(db, "totes", "staffAllocation");

const allocationDefaults = {
  ambientPick: "", chillPick: "", bagging: "", baggingRunner: 1,
  freezerPick: "", freezerDecant: 0, decant: "", mhe: 1,
  frameload: 3, bt: 2, vanLoad: 1, dekit: 1, totalIC: 2,
};
const inputDefaults = {
  ambientOutstanding: "", chillOutstanding: "", ambientUPH: "", chillUPH: "",
  pickBreakMinutes: "", pickCompletionTime: "", baggingOutstanding: "",
  baggingUPH: "", baggingBreakMinutes: "", baggingCompletionTime: "",
  freezerOutstanding: "", freezerUPH: "", freezerBreakMinutes: "",
  freezerCompletionTime: "", inboundUPH: "", inboundBreakMinutes: "",
  inboundCompletionTime: "",
};
const calculatedFields = new Set(["ambientPick", "chillPick", "bagging", "freezerPick", "decant"]);
const sourceFields = new Set([
  "ambientOutstanding", "chillOutstanding", "ambientUPH", "chillUPH",
  "pickBreakMinutes", "baggingOutstanding", "freezerOutstanding", "freezerUPH",
]);
const dependencies = {
  ambientOutstanding: ["ambientPick"], ambientUPH: ["ambientPick"],
  chillOutstanding: ["chillPick"], chillUPH: ["chillPick"],
  pickBreakMinutes: ["ambientPick", "chillPick"],
  pickCompletionTime: ["ambientPick", "chillPick"],
  baggingOutstanding: ["bagging"], baggingUPH: ["bagging"],
  baggingBreakMinutes: ["bagging"], baggingCompletionTime: ["bagging"],
  freezerOutstanding: ["freezerPick"], freezerUPH: ["freezerPick"],
  freezerBreakMinutes: ["freezerPick"], freezerCompletionTime: ["freezerPick"],
  inboundUPH: ["decant"], inboundBreakMinutes: ["decant"],
  inboundCompletionTime: ["decant"],
};
const number = (value) => Number(value) || 0;
const nonnegative = (value) => value === "" ? "" : Math.max(0, number(value));

function hoursUntil(time, breakMinutes) {
  if (!time) return 0;
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59) return 0;
  const now = new Date();
  const end = new Date();
  end.setHours(hour, minute, 0, 0);
  if (end <= now) end.setDate(end.getDate() + 1);
  return Math.max(0, (end.getTime() - now.getTime()) / 3600000 - number(breakMinutes) / 60);
}
function required(outstanding, uph, time, breakMinutes) {
  const hours = hoursUntil(time, breakMinutes);
  return number(outstanding) > 0 && number(uph) > 0 && hours > 0
    ? Math.ceil(number(outstanding) / (number(uph) * hours)) : 0;
}

function NumberField({ label, value, onChange, category = "manual", placeholder = "0" }) {
  return (
    <label className="staff-field">
      <span className="staff-field-label">{label}</span>
      <input type="number" min="0" inputMode="decimal" value={value}
        onChange={onChange} placeholder={placeholder}
        className={`staff-field-input staff-category-${category}`} />
    </label>
  );
}
function TimeField({ label, value, onChange }) {
  return (
    <label className="staff-field">
      <span className="staff-field-label">{label}</span>
      <input type="time" value={value} onChange={onChange}
        className="staff-field-input staff-time-input staff-category-manual" />
    </label>
  );
}

export default function StaffAllocation() {
  const [savedAllocation, setSavedAllocation] = useState(allocationDefaults);
  const [workInputs, setWorkInputs] = useState(inputDefaults);
  const [manualResults, setManualResults] = useState(new Set());
  const [manualSources, setManualSources] = useState(new Set());
  const [shiftHours, setShiftHours] = useState(0);
  const [shiftInbound, setShiftInbound] = useState(0);
  const [shiftKey, setShiftKey] = useState("");
  const [inboundOverride, setInboundOverride] = useState(null);
  const [availableOverride, setAvailableOverride] = useState(null);
  const [toast, setToast] = useState("");
  const sourceRef = useRef({});
  const manualSourceRef = useRef(new Set());
  const editedAllocationRef = useRef(new Set());
  const editedInputsRef = useRef(new Set());
  const editedAvailableRef = useRef(false);
  const editedInboundRef = useRef(false);
  const shiftKeyRef = useRef("");
  const toastTimer = useRef(null);

  const notify = (message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };
  const receiveSource = (values) => {
    sourceRef.current = { ...sourceRef.current, ...values };
    setWorkInputs((previous) => {
      const next = { ...previous };
      for (const [key, value] of Object.entries(values)) {
        if (!manualSourceRef.current.has(key)) next[key] = value;
      }
      return next;
    });
  };

  useEffect(() => {
    const stopShift = onSnapshot(SHIFT_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      const hours = data.totalHours != null ? number(data.totalHours)
        : Array.isArray(data.shiftData) ? data.shiftData.reduce(
          (sum, row) => sum + 10 * number(row.present) + number(row.ot) - number(row.vto), 0
        ) : 0;
      const inbound = number(data.ambInbound) + number(data.chillInbound) +
        number(data.freezerInbound) - number(data.outstandingPick);
      const outbound = number(data.ambientPick) + number(data.chillPick) + number(data.freezerPick);
      const target = data.targetProd == null ? 285 : number(data.targetProd);
      const computed = Math.max(0, Math.round(target > 0
        ? target / 1.13 * hours - inbound - outbound : 0));
      const key = JSON.stringify([hours, inbound, outbound, target]);
      if (shiftKeyRef.current && shiftKeyRef.current !== key) {
        editedInboundRef.current = false;
        setInboundOverride(null);
        setManualResults((previous) => {
          if (!previous.has("decant")) return previous;
          const next = new Set(previous);
          next.delete("decant");
          return next;
        });
      }
      shiftKeyRef.current = key;
      setShiftKey(key);
      setShiftHours(hours);
      setShiftInbound(computed);
    });
    const stopPick = onSnapshot(PICK_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      receiveSource({
        ambientOutstanding: data.ambientOutstanding ?? "",
        chillOutstanding: data.chillOutstanding ?? "",
        ambientUPH: data.ambientUPH ?? "",
        chillUPH: data.chillUPH ?? "",
        pickBreakMinutes: data.ambientBreak1 ?? "",
      });
    });
    const stopFreezer = onSnapshot(FREEZER_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      receiveSource({ freezerOutstanding: data.outstandingUPH ?? "", freezerUPH: data.uph ?? "" });
    });
    const stopBagged = onSnapshot(BAGGED_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      receiveSource({
        baggingOutstanding: data.resultAmbient == null || data.resultChill == null
          ? "" : Math.max(0, -(number(data.resultAmbient) + number(data.resultChill))),
      });
    });
    const stopStaff = onSnapshot(STAFF_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      const savedSourceOverrides = new Set(Array.isArray(data.manualSourceKeys)
        ? data.manualSourceKeys.filter((key) => sourceFields.has(key)) : []);
      for (const key of savedSourceOverrides) {
        if (!editedInputsRef.current.has(key)) manualSourceRef.current.add(key);
      }
      setManualSources(new Set(manualSourceRef.current));
      setSavedAllocation((previous) => {
        const next = { ...previous };
        for (const key of Object.keys(allocationDefaults)) {
          if (!editedAllocationRef.current.has(key)) next[key] = data[key] ?? allocationDefaults[key];
        }
        return next;
      });
      setWorkInputs((previous) => {
        const next = { ...previous };
        for (const key of Object.keys(inputDefaults)) {
          if (editedInputsRef.current.has(key)) continue;
          next[key] = sourceFields.has(key) && !manualSourceRef.current.has(key)
            ? (sourceRef.current[key] ?? "") : (data[key] ?? "");
        }
        return next;
      });
      setManualResults((previous) => {
        const next = new Set(previous);
        const savedKeys = Array.isArray(data.manualResultKeys) ? data.manualResultKeys : [];
        for (const key of savedKeys) {
          if (calculatedFields.has(key) && !editedAllocationRef.current.has(key)) next.add(key);
        }
        return next;
      });
      if (!editedAvailableRef.current) {
        setAvailableOverride(data.availableTeammates === "" || data.availableTeammates == null
          ? null : data.availableTeammates);
      }
      if (!editedInboundRef.current) {
        setInboundOverride(data.inboundNeededSource === shiftKeyRef.current &&
          data.inboundNeededOverride != null ? data.inboundNeededOverride : null);
      }
    });
    const clearLocal = () => {
      sourceRef.current = {};
      manualSourceRef.current = new Set();
      editedAllocationRef.current = new Set();
      editedInputsRef.current = new Set();
      editedAvailableRef.current = false;
      editedInboundRef.current = false;
      setManualResults(new Set());
      setManualSources(new Set());
      setSavedAllocation({ ...allocationDefaults });
      setWorkInputs({ ...inputDefaults });
      setAvailableOverride(null);
      setInboundOverride(null);
    };
    window.addEventListener("shift-planner-clear-all", clearLocal);
    return () => {
      stopShift(); stopPick(); stopFreezer(); stopBagged(); stopStaff();
      window.removeEventListener("shift-planner-clear-all", clearLocal);
      clearTimeout(toastTimer.current);
    };
  }, []);

  const inboundNeeded = inboundOverride === null ? shiftInbound : inboundOverride;
  const calculated = useMemo(() => ({
    ambientPick: required(workInputs.ambientOutstanding, workInputs.ambientUPH, workInputs.pickCompletionTime, workInputs.pickBreakMinutes),
    chillPick: required(workInputs.chillOutstanding, workInputs.chillUPH, workInputs.pickCompletionTime, workInputs.pickBreakMinutes),
    bagging: required(workInputs.baggingOutstanding, workInputs.baggingUPH, workInputs.baggingCompletionTime, workInputs.baggingBreakMinutes),
    freezerPick: required(workInputs.freezerOutstanding, workInputs.freezerUPH, workInputs.freezerCompletionTime, workInputs.freezerBreakMinutes),
    decant: required(inboundNeeded, workInputs.inboundUPH, workInputs.inboundCompletionTime, workInputs.inboundBreakMinutes),
  }), [workInputs, inboundNeeded]);
  const allocation = { ...savedAllocation };
  for (const key of calculatedFields) {
    if (!manualResults.has(key)) allocation[key] = calculated[key];
  }
  const autoAvailable = Math.ceil(shiftHours / 10);
  const available = availableOverride === null ? autoAvailable : number(availableOverride);
  const totalAllocated = Object.keys(allocationDefaults)
    .reduce((sum, key) => sum + number(allocation[key]), 0);
  const difference = available - totalAllocated;
  const totalPick = ["ambientPick", "chillPick", "bagging", "baggingRunner"]
    .reduce((sum, key) => sum + number(allocation[key]), 0);
  const totalFreezer = number(allocation.freezerPick) + number(allocation.freezerDecant);
  const totalInbound = number(allocation.decant) + number(allocation.mhe);
  const totalDispatch = ["frameload", "bt", "vanLoad", "dekit"]
    .reduce((sum, key) => sum + number(allocation[key]), 0);

  const changeAllocation = (key, value) => {
    editedAllocationRef.current.add(key);
    if (calculatedFields.has(key)) {
      setManualResults((previous) => new Set(previous).add(key));
    }
    setSavedAllocation((previous) => ({ ...previous, [key]: nonnegative(value) }));
  };
  const changeInput = (key, value) => {
    editedInputsRef.current.add(key);
    if (sourceFields.has(key)) {
      manualSourceRef.current.add(key);
      setManualSources(new Set(manualSourceRef.current));
    }
    setWorkInputs((previous) => ({ ...previous, [key]: value }));
    if (dependencies[key]) {
      setManualResults((previous) => {
        const next = new Set(previous);
        dependencies[key].forEach((field) => next.delete(field));
        return next;
      });
    }
  };
  const changeInbound = (value) => {
    editedInboundRef.current = true;
    setInboundOverride(value === "" ? null : nonnegative(value));
    setManualResults((previous) => {
      const next = new Set(previous);
      next.delete("decant");
      return next;
    });
  };
  const allocationField = (label, key) => (
    <NumberField label={label} value={allocation[key]}
      onChange={(event) => changeAllocation(key, event.target.value)}
      category={calculatedFields.has(key) ? "calculated" : "default"} />
  );
  const inputField = (label, key, placeholder = "0") => (
    <NumberField label={label} value={workInputs[key]} placeholder={placeholder}
      onChange={(event) => changeInput(key, event.target.value)}
      category={sourceFields.has(key) ? "extracted" : "manual"} />
  );
  const timeField = (label, key) => (
    <TimeField label={label} value={workInputs[key]}
      onChange={(event) => changeInput(key, event.target.value)} />
  );

  const save = async () => {
    try {
      await setDoc(STAFF_DOC, {
        ...allocation, ...workInputs, manualResultKeys: [...manualResults],
        manualSourceKeys: [...manualSources],
        availableTeammates: availableOverride ?? "",
        inboundNeededOverride: inboundOverride,
        inboundNeededSource: inboundOverride === null ? null : shiftKey,
      }, { merge: true });
      notify("Staff Allocation Saved");
    } catch (error) {
      console.error(error);
      notify("Could not save Staff Allocation");
    }
  };
  const clear = async () => {
    try {
      await setDoc(STAFF_DOC, {
        ...allocationDefaults, ...inputDefaults,
        manualResultKeys: [], manualSourceKeys: [],
        availableTeammates: "", inboundNeededOverride: null,
        inboundNeededSource: null,
      }, { merge: true });
      editedAllocationRef.current = new Set();
      editedInputsRef.current = new Set();
      editedAvailableRef.current = false;
      editedInboundRef.current = false;
      manualSourceRef.current = new Set();
      setManualResults(new Set());
      setManualSources(new Set());
      setSavedAllocation({ ...allocationDefaults });
      setWorkInputs({ ...inputDefaults, ...sourceRef.current });
      setAvailableOverride(null);
      setInboundOverride(null);
      notify("Staff Allocation Cleared");
    } catch (error) {
      console.error(error);
      notify("Could not clear Staff Allocation");
    }
  };

  return (
    <section className="data-card staff-allocation-card">
      <h2 className="data-title">Staff Allocation</h2>
      <div className="staff-allocation-top-row">
        <div className="staff-allocation-limit">
          <div><span>Shift EOS Total Hours</span><strong>{shiftHours.toFixed(2)}</strong></div>
          <label className="staff-available-card">
            <span>Available Teammates</span>
            <input type="number" min="0" inputMode="numeric" value={available}
              onChange={(event) => {
                editedAvailableRef.current = true;
                setAvailableOverride(event.target.value === "" ? null : nonnegative(event.target.value));
              }} aria-label="Available Teammates" className="staff-category-calculated" />
            <small>{availableOverride === null ? "Calculated from total hours" : "Editable override; erase to recalculate"}</small>
          </label>
          <div><span>Allocated Teammates</span><strong>{totalAllocated}</strong></div>
          <div className={`difference-card ${difference < 0 ? "allocation-over-limit" : ""}`}>
            <span>Difference</span><strong>{difference}</strong>
          </div>
        </div>
        <div className="staff-allocation-actions staff-allocation-top-actions">
          <button type="button" className="calculate-btn" onClick={save}>Save</button>
          <button type="button" className="clear-btn" onClick={clear}>Clear</button>
        </div>
      </div>
      <div className="staff-allocation-grid">
        <section className="staff-group-card pick-card">
          <div className="staff-group-card-header"><h3>Pick / Bag</h3><span>Total: {totalPick}</span></div>
          <div className="staff-fields-grid staff-pick-allocation-row">
            {allocationField("Ambient Pick", "ambientPick")}
            {allocationField("Chill Pick", "chillPick")}
            {allocationField("Bagging", "bagging")}
            {allocationField("Bagging Runner", "baggingRunner")}
          </div>
          <div className="staff-group-divider">Pick workload details</div>
          <div className="staff-fields-grid">
            {inputField("Ambient Outstanding", "ambientOutstanding")}
            {inputField("Chill Outstanding", "chillOutstanding")}
            {inputField("Ambient UPH", "ambientUPH")}
            {inputField("Chill UPH", "chillUPH")}
            {inputField("Pick Break (min)", "pickBreakMinutes", "Minutes")}
            {timeField("Pick Completion", "pickCompletionTime")}
          </div>
          <div className="staff-group-divider">Bagging workload details</div>
          <div className="staff-fields-grid">
            {inputField("Bagging Outstanding", "baggingOutstanding")}
            {inputField("Bagging UPH", "baggingUPH")}
            {inputField("Bagging Break (min)", "baggingBreakMinutes", "Minutes")}
            {timeField("Bagging Completion", "baggingCompletionTime")}
          </div>
        </section>
        <section className="staff-group-card freezer-card">
          <div className="staff-group-card-header"><h3>Freezer</h3><span>Total: {totalFreezer}</span></div>
          <div className="staff-fields-grid">
            {allocationField("Freezer Pick", "freezerPick")}
            {allocationField("Freezer Decant", "freezerDecant")}
          </div>
          <div className="staff-group-divider">Freezer workload details</div>
          <div className="staff-fields-grid">
            {inputField("Outstanding Picks", "freezerOutstanding")}
            {inputField("Freezer UPH", "freezerUPH")}
            {inputField("Break (min)", "freezerBreakMinutes", "Minutes")}
            {timeField("Completion", "freezerCompletionTime")}
          </div>
        </section>
        <section className="staff-group-card inbound-card">
          <div className="staff-group-card-header"><h3>Inbound</h3><span>Total: {totalInbound}</span></div>
          <div className="staff-fields-grid">
            {allocationField("Decant", "decant")}
            {allocationField("MHE", "mhe")}
          </div>
          <div className="staff-group-divider">Inbound workload details</div>
          <div className="staff-fields-grid">
            <NumberField label="Inbound Needed" value={inboundNeeded}
              onChange={(event) => changeInbound(event.target.value)} category="extracted" />
            {inputField("Inbound UPH", "inboundUPH")}
            {inputField("Break (min)", "inboundBreakMinutes", "Minutes")}
            {timeField("Completion", "inboundCompletionTime")}
          </div>
        </section>
        <section className="staff-group-card dispatch-card">
          <div className="staff-group-card-header"><h3>Dispatch</h3><span>Total: {totalDispatch}</span></div>
          <div className="staff-fields-grid">
            {allocationField("Frameload", "frameload")}
            {allocationField("BT", "bt")}
            {allocationField("Van Load", "vanLoad")}
            {allocationField("Dekit", "dekit")}
          </div>
        </section>
        <div className="ic-column">
  <section className="staff-group-card ic-card">
    <div className="staff-group-card-header">
      <h3>IC</h3>
      <span>Total: {allocation.totalIC}</span>
    </div>

    <div className="staff-fields-grid staff-fields-grid-single">
      {allocationField("Total IC", "totalIC")}
    </div>
  </section>

  <div className="staff-legend-row" aria-label="Input color key">
    <div>
      <i className="staff-legend-swatch staff-legend-default" />&nbsp;
      Default value
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      <i className="staff-legend-swatch staff-legend-extracted" />&nbsp;
      Extracted from another slide
    </div>

    <div>
      <i className="staff-legend-swatch staff-legend-calculated" />&nbsp;
      Calculated staff / Available Teammates
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      <i className="staff-legend-swatch staff-legend-manual" />&nbsp;
      Manually entered field
    </div>
  </div>
</div>
      </div>
      {toast && <div className="toast-notification-center">{toast}</div>}
    </section>
  );
}
