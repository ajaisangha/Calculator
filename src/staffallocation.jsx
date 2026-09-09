import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import "./staffallocation.css";

const SHIFT_EOS_DOC = doc(db, "totes", "shiftEOS");
const PICK_DOC = doc(db, "totes", "pickCalculator");
const STAFF_ALLOCATION_DOC = doc(db, "totes", "staffAllocation");

const emptyAllocation = {
  ambientPick: "",
  chillPick: "",
  bagging: "",
  baggingRunner: 1,
  freezerPick: "",
  freezerDecant: 0,
  decant: "",
  mhe: 1,
  frameload: 3,
  bt: 2,
  vanLoad: 1,
  dekit: 1,
  totalIC: 2,
};

const emptyWorkInputs = {
  ambientOutstanding: "",
  chillOutstanding: "",
  ambientUPH: "",
  chillUPH: "",
  pickBreakMinutes: "",
  pickCompletionTime: "",
  baggingOutstanding: "",
  baggingUPH: "",
  baggingBreakMinutes: "",
  baggingCompletionTime: "",
  freezerOutstanding: "",
  freezerUPH: "",
  freezerBreakMinutes: "",
  freezerCompletionTime: "",
  inboundUPH: "",
  inboundBreakMinutes: "",
  inboundCompletionTime: "",
};

const calculatedFieldKeys = [
  "ambientPick",
  "chillPick",
  "bagging",
  "freezerPick",
  "decant",
];

const pickDerivedWorkInputKeys = [
  "ambientOutstanding",
  "chillOutstanding",
  "ambientUPH",
  "chillUPH",
  "pickBreakMinutes",
];

function getNumber(value) {
  return Number(value) || 0;
}

function getHoursUntilCompletion(completionTime, breakMinutes = 0) {
  if (!completionTime) return 0;

  const [hoursText, minutesText] = completionTime.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }

  const now = new Date();
  const completion = new Date();

  completion.setHours(hours, minutes, 0, 0);

  if (completion <= now) {
    completion.setDate(completion.getDate() + 1);
  }

  const rawHours = (completion.getTime() - now.getTime()) / 3600000;
  const breakHours = getNumber(breakMinutes) / 60;

  return Math.max(0, rawHours - breakHours);
}

function calculateRequiredStaff(outstanding, uph, completionTime, breakMinutes) {
  const totalOutstanding = getNumber(outstanding);
  const rate = getNumber(uph);
  const hoursLeft = getHoursUntilCompletion(completionTime, breakMinutes);

  if (!totalOutstanding || !rate || !hoursLeft) {
    return 0;
  }

  return Math.ceil(totalOutstanding / (rate * hoursLeft));
}

function getTotalAllocated(allocation) {
  return (
    getNumber(allocation.ambientPick) +
    getNumber(allocation.chillPick) +
    getNumber(allocation.bagging) +
    getNumber(allocation.baggingRunner) +
    getNumber(allocation.freezerPick) +
    getNumber(allocation.freezerDecant) +
    getNumber(allocation.decant) +
    getNumber(allocation.mhe) +
    getNumber(allocation.frameload) +
    getNumber(allocation.bt) +
    getNumber(allocation.vanLoad) +
    getNumber(allocation.dekit) +
    getNumber(allocation.totalIC)
  );
}

function NumberField({
  label,
  value,
  onChange,
  readOnly = false,
  calculated = false,
  placeholder = "0",
}) {
  return (
    <label className="staff-field">
      <span className="staff-field-label">{label}</span>

      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`staff-field-input ${
          calculated ? "staff-field-calculated" : ""
        } ${readOnly ? "staff-readonly-input" : ""}`}
      />
    </label>
  );
}

function TimeField({ label, value, onChange }) {
  return (
    <label className="staff-field">
      <span className="staff-field-label">{label}</span>

      <input
        type="time"
        value={value}
        onChange={onChange}
        className="staff-field-input staff-time-input"
      />
    </label>
  );
}

export default function StaffAllocation() {
  const [allocation, setAllocation] = useState(emptyAllocation);
  const [totalHours, setTotalHours] = useState(0);
  const [inboundNeeded, setInboundNeeded] = useState(0);
  const [workInputs, setWorkInputs] = useState(emptyWorkInputs);
  const [pickDerivedValues, setPickDerivedValues] = useState({
    ambientOutstanding: "",
    chillOutstanding: "",
    ambientUPH: "",
    chillUPH: "",
    pickBreakMinutes: "",
  });
  const [availableTeammatesInput, setAvailableTeammatesInput] = useState("");
  const [manualOverrides, setManualOverrides] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: "" });

  const initializedFromFirestore = useRef(false);
  const editedWorkInputKeys = useRef(new Set());
  const editedAllocationKeys = useRef(new Set());
  const availableTeammatesEdited = useRef(false);
  const toastTimerRef = useRef(null);

  const showToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ show: true, message });

    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: "" });
      toastTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(SHIFT_EOS_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        setTotalHours(0);
        setInboundNeeded(0);
        return;
      }

      const data = snapshot.data() || {};

      const shiftTotalHours = Number(data.totalHours) || 0;
      const targetProductivity = Number(data.targetProd) || 0;
      const ambientInbound = Number(data.ambInbound) || 0;
      const chillInbound = Number(data.chillInbound) || 0;
      const freezerInbound = Number(data.freezerInbound) || 0;
      const outstandingPick = Number(data.outstandingPick) || 0;
      const ambientPick = Number(data.ambientPick) || 0;
      const chillPick = Number(data.chillPick) || 0;
      const freezerPick = Number(data.freezerPick) || 0;

      const totalInbound =
        ambientInbound + chillInbound + freezerInbound - outstandingPick;

      const totalOutbound = ambientPick + chillPick + freezerPick;

      const calculatedInboundNeeded =
        targetProductivity > 0
          ? (targetProductivity / 1.13) * shiftTotalHours -
            (totalInbound + totalOutbound)
          : 0;

      setTotalHours(shiftTotalHours);
      setInboundNeeded(Math.max(0, Math.round(calculatedInboundNeeded)));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(PICK_DOC, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() || {};

      const latestPickDerivedValues = {
        ambientOutstanding: data.ambientOutstanding ?? "",
        chillOutstanding: data.chillOutstanding ?? "",
        ambientUPH: data.ambientUPH ?? "",
        chillUPH: data.chillUPH ?? "",
        pickBreakMinutes: data.ambientBreak1 ?? "",
      };

      setPickDerivedValues(latestPickDerivedValues);

      setWorkInputs((previous) => ({
        ...previous,
        ambientOutstanding: editedWorkInputKeys.current.has(
          "ambientOutstanding"
        )
          ? previous.ambientOutstanding
          : latestPickDerivedValues.ambientOutstanding,
        chillOutstanding: editedWorkInputKeys.current.has("chillOutstanding")
          ? previous.chillOutstanding
          : latestPickDerivedValues.chillOutstanding,
        ambientUPH: editedWorkInputKeys.current.has("ambientUPH")
          ? previous.ambientUPH
          : latestPickDerivedValues.ambientUPH,
        chillUPH: editedWorkInputKeys.current.has("chillUPH")
          ? previous.chillUPH
          : latestPickDerivedValues.chillUPH,
        pickBreakMinutes: editedWorkInputKeys.current.has("pickBreakMinutes")
          ? previous.pickBreakMinutes
          : latestPickDerivedValues.pickBreakMinutes,
      }));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(STAFF_ALLOCATION_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};

      if (!initializedFromFirestore.current) {
        setAllocation({
          ambientPick: data.ambientPick ?? "",
          chillPick: data.chillPick ?? "",
          bagging: data.bagging ?? "",
          baggingRunner: data.baggingRunner ?? 1,
          freezerPick: data.freezerPick ?? "",
          freezerDecant: data.freezerDecant ?? 0,
          decant: data.decant ?? "",
          mhe: data.mhe ?? 1,
          frameload: data.frameload ?? 3,
          bt: data.bt ?? 2,
          vanLoad: data.vanLoad ?? 1,
          dekit: data.dekit ?? 1,
          totalIC: data.totalIC ?? 2,
        });

        setWorkInputs((previous) => ({
          ...previous,
          ambientOutstanding:
            data.ambientOutstanding ??
            previous.ambientOutstanding ??
            pickDerivedValues.ambientOutstanding,
          chillOutstanding:
            data.chillOutstanding ??
            previous.chillOutstanding ??
            pickDerivedValues.chillOutstanding,
          ambientUPH:
            data.ambientUPH ??
            previous.ambientUPH ??
            pickDerivedValues.ambientUPH,
          chillUPH:
            data.chillUPH ??
            previous.chillUPH ??
            pickDerivedValues.chillUPH,
          pickBreakMinutes:
            data.pickBreakMinutes ??
            previous.pickBreakMinutes ??
            pickDerivedValues.pickBreakMinutes,
          pickCompletionTime: data.pickCompletionTime ?? "",
          baggingOutstanding: data.baggingOutstanding ?? "",
          baggingUPH: data.baggingUPH ?? "",
          baggingBreakMinutes: data.baggingBreakMinutes ?? "",
          baggingCompletionTime: data.baggingCompletionTime ?? "",
          freezerOutstanding: data.freezerOutstanding ?? "",
          freezerUPH: data.freezerUPH ?? "",
          freezerBreakMinutes: data.freezerBreakMinutes ?? "",
          freezerCompletionTime: data.freezerCompletionTime ?? "",
          inboundUPH: data.inboundUPH ?? "",
          inboundBreakMinutes: data.inboundBreakMinutes ?? "",
          inboundCompletionTime: data.inboundCompletionTime ?? "",
        }));

        setAvailableTeammatesInput(data.availableTeammates ?? "");
        initializedFromFirestore.current = true;
        return;
      }

      setAllocation((previous) => {
        const next = { ...previous };

        Object.keys(emptyAllocation).forEach((key) => {
          if (!editedAllocationKeys.current.has(key)) {
            next[key] = data[key] ?? emptyAllocation[key];
          }
        });

        return next;
      });

      setWorkInputs((previous) => {
        const next = { ...previous };

        Object.keys(emptyWorkInputs).forEach((key) => {
          if (pickDerivedWorkInputKeys.includes(key)) {
            return;
          }

          if (!editedWorkInputKeys.current.has(key)) {
            next[key] = data[key] ?? "";
          }
        });

        return next;
      });

      if (!availableTeammatesEdited.current) {
        setAvailableTeammatesInput(data.availableTeammates ?? "");
      }
    });

    return unsubscribe;
  }, [pickDerivedValues]);

  const calculatedAmbientPick = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.ambientOutstanding,
        workInputs.ambientUPH,
        workInputs.pickCompletionTime,
        workInputs.pickBreakMinutes
      ),
    [
      workInputs.ambientOutstanding,
      workInputs.ambientUPH,
      workInputs.pickCompletionTime,
      workInputs.pickBreakMinutes,
    ]
  );

  const calculatedChillPick = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.chillOutstanding,
        workInputs.chillUPH,
        workInputs.pickCompletionTime,
        workInputs.pickBreakMinutes
      ),
    [
      workInputs.chillOutstanding,
      workInputs.chillUPH,
      workInputs.pickCompletionTime,
      workInputs.pickBreakMinutes,
    ]
  );

  const calculatedBagging = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.baggingOutstanding,
        workInputs.baggingUPH,
        workInputs.baggingCompletionTime,
        workInputs.baggingBreakMinutes
      ),
    [
      workInputs.baggingOutstanding,
      workInputs.baggingUPH,
      workInputs.baggingCompletionTime,
      workInputs.baggingBreakMinutes,
    ]
  );

  const calculatedFreezerPick = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.freezerOutstanding,
        workInputs.freezerUPH,
        workInputs.freezerCompletionTime,
        workInputs.freezerBreakMinutes
      ),
    [
      workInputs.freezerOutstanding,
      workInputs.freezerUPH,
      workInputs.freezerCompletionTime,
      workInputs.freezerBreakMinutes,
    ]
  );

  const calculatedDecant = useMemo(
    () =>
      calculateRequiredStaff(
        inboundNeeded,
        workInputs.inboundUPH,
        workInputs.inboundCompletionTime,
        workInputs.inboundBreakMinutes
      ),
    [
      inboundNeeded,
      workInputs.inboundUPH,
      workInputs.inboundCompletionTime,
      workInputs.inboundBreakMinutes,
    ]
  );

  const calculatedValues = useMemo(
    () => ({
      ambientPick: calculatedAmbientPick,
      chillPick: calculatedChillPick,
      bagging: calculatedBagging,
      freezerPick: calculatedFreezerPick,
      decant: calculatedDecant,
    }),
    [
      calculatedAmbientPick,
      calculatedChillPick,
      calculatedBagging,
      calculatedFreezerPick,
      calculatedDecant,
    ]
  );

  useEffect(() => {
    setAllocation((previous) => {
      const updated = { ...previous };
      let hasChanges = false;

      calculatedFieldKeys.forEach((key) => {
        if (!manualOverrides.has(key) && updated[key] !== calculatedValues[key]) {
          updated[key] = calculatedValues[key];
          hasChanges = true;
        }
      });

      return hasChanges ? updated : previous;
    });
  }, [calculatedValues, manualOverrides]);

  const automaticAvailableTeammates = Math.ceil(totalHours / 10);

  const availableTeammates =
    availableTeammatesInput === ""
      ? automaticAvailableTeammates
      : Math.max(0, getNumber(availableTeammatesInput));

  const totalAllocated = getTotalAllocated(allocation);
  const difference = availableTeammates - totalAllocated;

  const updateAvailableTeammates = (value) => {
    availableTeammatesEdited.current = true;

    if (value === "") {
      setAvailableTeammatesInput("");
      return;
    }

    setAvailableTeammatesInput(Math.max(0, Number(value) || 0));
  };

  const updateAllocation = (key, value) => {
    const numericValue = value === "" ? "" : Math.max(0, Number(value) || 0);

    editedAllocationKeys.current.add(key);

    if (calculatedFieldKeys.includes(key)) {
      setManualOverrides((previous) => {
        const next = new Set(previous);
        next.add(key);
        return next;
      });
    }

    setAllocation((previous) => ({
      ...previous,
      [key]: numericValue,
    }));
  };

  const updateWorkInput = (key, value) => {
    editedWorkInputKeys.current.add(key);

    setWorkInputs((previous) => ({
      ...previous,
      [key]: value,
    }));

    const dependentCalculatedFields = {
      ambientOutstanding: ["ambientPick"],
      ambientUPH: ["ambientPick"],
      chillOutstanding: ["chillPick"],
      chillUPH: ["chillPick"],
      pickBreakMinutes: ["ambientPick", "chillPick"],
      pickCompletionTime: ["ambientPick", "chillPick"],
      baggingOutstanding: ["bagging"],
      baggingUPH: ["bagging"],
      baggingBreakMinutes: ["bagging"],
      baggingCompletionTime: ["bagging"],
      freezerOutstanding: ["freezerPick"],
      freezerUPH: ["freezerPick"],
      freezerBreakMinutes: ["freezerPick"],
      freezerCompletionTime: ["freezerPick"],
      inboundUPH: ["decant"],
      inboundBreakMinutes: ["decant"],
      inboundCompletionTime: ["decant"],
    };

    const fieldsToRecalculate = dependentCalculatedFields[key] || [];

    if (fieldsToRecalculate.length > 0) {
      setManualOverrides((previous) => {
        const next = new Set(previous);

        fieldsToRecalculate.forEach((fieldKey) => {
          next.delete(fieldKey);
        });

        return next;
      });
    }
  };

  useEffect(() => {
    setManualOverrides((previous) => {
      if (!previous.has("decant")) return previous;

      const next = new Set(previous);
      next.delete("decant");
      return next;
    });
  }, [inboundNeeded]);

  const totalPick =
    getNumber(allocation.ambientPick) +
    getNumber(allocation.chillPick) +
    getNumber(allocation.bagging) +
    getNumber(allocation.baggingRunner);

  const totalFreezer =
    getNumber(allocation.freezerPick) +
    getNumber(allocation.freezerDecant);

  const totalInbound =
    getNumber(allocation.decant) + getNumber(allocation.mhe);

  const totalDispatch =
    getNumber(allocation.frameload) +
    getNumber(allocation.bt) +
    getNumber(allocation.vanLoad) +
    getNumber(allocation.dekit);

  const saveAllocation = async () => {
    try {
      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...allocation,
          ...workInputs,
          availableTeammates: availableTeammatesInput,
        },
        { merge: true }
      );

      showToast("Staff Allocation Saved");
    } catch (error) {
      console.error("Staff allocation save error:", error);
      showToast("Could not save Staff Allocation");
    }
  };

  const clearAllocation = async () => {
    try {
      /*
        Remove local edit tracking first. This allows the Pick slide's
        newest Firebase values to be restored into editable input fields.
      */
      editedWorkInputKeys.current = new Set();
      editedAllocationKeys.current = new Set();
      availableTeammatesEdited.current = false;

      setManualOverrides(new Set());
      setAllocation(emptyAllocation);
      setAvailableTeammatesInput("");

      /*
        The five Pick-derived fields are restored from PICK_DOC.
        All other Staff Allocation workload inputs are cleared.
      */
      setWorkInputs({
        ...emptyWorkInputs,
        ...pickDerivedValues,
      });

      /*
        Only overwrite the Staff Allocation document.
        Nothing in the Pick Calculator document or another slide changes.
      */
      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...emptyAllocation,
          ...emptyWorkInputs,
          availableTeammates: "",
        },
        { merge: true }
      );

      showToast("Staff Allocation Cleared");
    } catch (error) {
      console.error("Staff allocation clear error:", error);
      showToast("Could not clear Staff Allocation");
    }
  };

  return (
    <section className="data-card staff-allocation-card">
      <h2 className="data-title">Staff Allocation</h2>

      <div className="staff-allocation-top-row">
        <div className="staff-allocation-limit">
          <div>
            <span>Shift EOS Total Hours</span>
            <strong>{totalHours.toFixed(2)}</strong>
          </div>

          <label className="available-teammates-card">
            <span>Available Teammates</span>

            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={availableTeammatesInput}
              onChange={(event) =>
                updateAvailableTeammates(event.target.value)
              }
              placeholder={String(automaticAvailableTeammates)}
              aria-label="Available Teammates"
            />

            <small>
              {availableTeammatesInput === ""
                ? "Auto from total hours"
                : "Manual value"}
            </small>
          </label>

          <div>
            <span>Allocated Teammates</span>
            <strong>{totalAllocated}</strong>
          </div>

          <div
            className={`difference-card ${
              difference < 0 ? "allocation-over-limit" : ""
            }`}
          >
            <span>Difference</span>
            <strong>{difference}</strong>
          </div>
        </div>

        <div className="staff-allocation-actions staff-allocation-top-actions">
          <button className="calculate-btn" onClick={saveAllocation}>
            Save
          </button>

          <button className="clear-btn" onClick={clearAllocation}>
            Clear
          </button>
        </div>
      </div>

      <div className="staff-allocation-grid">
        <section className="staff-group-card pick-card">
          <div className="staff-group-card-header">
            <h3>Pick</h3>
            <span>Total: {totalPick}</span>
          </div>

          <div className="staff-fields-grid staff-pick-allocation-row">
            <NumberField
              label="Ambient Pick"
              value={allocation.ambientPick}
              onChange={(event) =>
                updateAllocation("ambientPick", event.target.value)
              }
              calculated
            />

            <NumberField
              label="Chill Pick"
              value={allocation.chillPick}
              onChange={(event) =>
                updateAllocation("chillPick", event.target.value)
              }
              calculated
            />

            <NumberField
              label="Bagging"
              value={allocation.bagging}
              onChange={(event) =>
                updateAllocation("bagging", event.target.value)
              }
              calculated
            />

            <NumberField
              label="Bagging Runner"
              value={allocation.baggingRunner}
              onChange={(event) =>
                updateAllocation("baggingRunner", event.target.value)
              }
            />
          </div>

          <div className="staff-group-divider">Pick workload details</div>

          <div className="staff-fields-grid">
            <NumberField
              label="Ambient Outstanding"
              value={workInputs.ambientOutstanding}
              onChange={(event) =>
                updateWorkInput("ambientOutstanding", event.target.value)
              }
            />

            <NumberField
              label="Chill Outstanding"
              value={workInputs.chillOutstanding}
              onChange={(event) =>
                updateWorkInput("chillOutstanding", event.target.value)
              }
            />

            <NumberField
              label="Ambient UPH"
              value={workInputs.ambientUPH}
              onChange={(event) =>
                updateWorkInput("ambientUPH", event.target.value)
              }
            />

            <NumberField
              label="Chill UPH"
              value={workInputs.chillUPH}
              onChange={(event) =>
                updateWorkInput("chillUPH", event.target.value)
              }
            />

            <NumberField
              label="Pick Break (min)"
              value={workInputs.pickBreakMinutes}
              onChange={(event) =>
                updateWorkInput("pickBreakMinutes", event.target.value)
              }
              placeholder="Minutes"
            />

            <TimeField
              label="Pick Completion"
              value={workInputs.pickCompletionTime}
              onChange={(event) =>
                updateWorkInput("pickCompletionTime", event.target.value)
              }
            />
          </div>

          <div className="staff-group-divider">Bagging workload details</div>

          <div className="staff-fields-grid">
            <NumberField
              label="Bagging Outstanding"
              value={workInputs.baggingOutstanding}
              onChange={(event) =>
                updateWorkInput("baggingOutstanding", event.target.value)
              }
            />

            <NumberField
              label="Bagging UPH"
              value={workInputs.baggingUPH}
              onChange={(event) =>
                updateWorkInput("baggingUPH", event.target.value)
              }
            />

            <NumberField
              label="Bagging Break (min)"
              value={workInputs.baggingBreakMinutes}
              onChange={(event) =>
                updateWorkInput("baggingBreakMinutes", event.target.value)
              }
              placeholder="Minutes"
            />

            <TimeField
              label="Bagging Completion"
              value={workInputs.baggingCompletionTime}
              onChange={(event) =>
                updateWorkInput("baggingCompletionTime", event.target.value)
              }
            />
          </div>
        </section>

        <section className="staff-group-card freezer-card">
          <div className="staff-group-card-header">
            <h3>Freezer</h3>
            <span>Total: {totalFreezer}</span>
          </div>

          <div className="staff-fields-grid">
            <NumberField
              label="Freezer Pick"
              value={allocation.freezerPick}
              onChange={(event) =>
                updateAllocation("freezerPick", event.target.value)
              }
              calculated
            />

            <NumberField
              label="Freezer Decant"
              value={allocation.freezerDecant}
              onChange={(event) =>
                updateAllocation("freezerDecant", event.target.value)
              }
            />
          </div>

          <div className="staff-group-divider">Freezer workload details</div>

          <div className="staff-fields-grid">
            <NumberField
              label="Outstanding Picks"
              value={workInputs.freezerOutstanding}
              onChange={(event) =>
                updateWorkInput("freezerOutstanding", event.target.value)
              }
            />

            <NumberField
              label="Freezer UPH"
              value={workInputs.freezerUPH}
              onChange={(event) =>
                updateWorkInput("freezerUPH", event.target.value)
              }
            />

            <NumberField
              label="Break (min)"
              value={workInputs.freezerBreakMinutes}
              onChange={(event) =>
                updateWorkInput("freezerBreakMinutes", event.target.value)
              }
              placeholder="Minutes"
            />

            <TimeField
              label="Completion"
              value={workInputs.freezerCompletionTime}
              onChange={(event) =>
                updateWorkInput("freezerCompletionTime", event.target.value)
              }
            />
          </div>
        </section>

        <section className="staff-group-card inbound-card">
          <div className="staff-group-card-header">
            <h3>Inbound</h3>
            <span>Total: {totalInbound}</span>
          </div>

          <div className="staff-fields-grid">
            <NumberField
              label="Decant"
              value={allocation.decant}
              onChange={(event) =>
                updateAllocation("decant", event.target.value)
              }
              calculated
            />

            <NumberField
              label="MHE"
              value={allocation.mhe}
              onChange={(event) =>
                updateAllocation("mhe", event.target.value)
              }
            />
          </div>

          <div className="staff-group-divider">Inbound workload details</div>

          <div className="staff-fields-grid">
            <NumberField
              label="Inbound Needed"
              value={inboundNeeded}
              readOnly
              calculated
            />

            <NumberField
              label="Inbound UPH"
              value={workInputs.inboundUPH}
              onChange={(event) =>
                updateWorkInput("inboundUPH", event.target.value)
              }
            />

            <NumberField
              label="Break (min)"
              value={workInputs.inboundBreakMinutes}
              onChange={(event) =>
                updateWorkInput("inboundBreakMinutes", event.target.value)
              }
              placeholder="Minutes"
            />

            <TimeField
              label="Completion"
              value={workInputs.inboundCompletionTime}
              onChange={(event) =>
                updateWorkInput("inboundCompletionTime", event.target.value)
              }
            />
          </div>
        </section>

        <section className="staff-group-card dispatch-card">
          <div className="staff-group-card-header">
            <h3>Dispatch</h3>
            <span>Total: {totalDispatch}</span>
          </div>

          <div className="staff-fields-grid">
            <NumberField
              label="Frameload"
              value={allocation.frameload}
              onChange={(event) =>
                updateAllocation("frameload", event.target.value)
              }
            />

            <NumberField
              label="BT"
              value={allocation.bt}
              onChange={(event) =>
                updateAllocation("bt", event.target.value)
              }
            />

            <NumberField
              label="Van Load"
              value={allocation.vanLoad}
              onChange={(event) =>
                updateAllocation("vanLoad", event.target.value)
              }
            />

            <NumberField
              label="Dekit"
              value={allocation.dekit}
              onChange={(event) =>
                updateAllocation("dekit", event.target.value)
              }
            />
          </div>
        </section>

        <section className="staff-group-card ic-card">
          <div className="staff-group-card-header">
            <h3>IC</h3>
            <span>Total: {allocation.totalIC}</span>
          </div>

          <div className="staff-fields-grid staff-fields-grid-single">
            <NumberField
              label="Total IC"
              value={allocation.totalIC}
              onChange={(event) =>
                updateAllocation("totalIC", event.target.value)
              }
            />
          </div>
        </section>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}