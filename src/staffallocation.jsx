import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import "./staffallocation.css";

const SHIFT_EOS_DOC = doc(db, "totes", "shiftEOS");
const PICK_DOC = doc(db, "totes", "pickCalculator");
const STAFF_ALLOCATION_DOC = doc(db, "totes", "staffAllocation");

const emptyAllocation = {
  baggingRunner: 1,
  freezerDecant: 0,
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
  const [toast, setToast] = useState({ show: false, message: "" });

  const initializedFromFirestore = useRef(false);
  const editedWorkInputKeys = useRef(new Set());
  const editedAllocationKeys = useRef(new Set());
  const toastTimerRef = useRef(null);
  const shownShortfallRef = useRef("");

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
      const totalInboundOutbound = totalInbound + totalOutbound;

      const calculatedInboundNeeded =
        targetProductivity > 0
          ? (targetProductivity / 1.13) * shiftTotalHours -
            totalInboundOutbound
          : 0;

      setTotalHours(shiftTotalHours);
      setInboundNeeded(Math.max(0, Math.round(calculatedInboundNeeded)));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(STAFF_ALLOCATION_DOC, (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() || {} : {};

      if (!initializedFromFirestore.current) {
        setAllocation({
          baggingRunner: data.baggingRunner ?? 1,
          freezerDecant: data.freezerDecant ?? 0,
          mhe: data.mhe ?? 1,
          frameload: data.frameload ?? 3,
          bt: data.bt ?? 2,
          vanLoad: data.vanLoad ?? 1,
          dekit: data.dekit ?? 1,
          totalIC: data.totalIC ?? 2,
        });

        setWorkInputs({
          ambientOutstanding: data.ambientOutstanding ?? "",
          chillOutstanding: data.chillOutstanding ?? "",
          ambientUPH: data.ambientUPH ?? "",
          chillUPH: data.chillUPH ?? "",
          pickBreakMinutes: data.pickBreakMinutes ?? "",
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
        });

        initializedFromFirestore.current = true;
        return;
      }

      setAllocation((previous) => ({
        baggingRunner: editedAllocationKeys.current.has("baggingRunner")
          ? previous.baggingRunner
          : data.baggingRunner ?? 1,
        freezerDecant: editedAllocationKeys.current.has("freezerDecant")
          ? previous.freezerDecant
          : data.freezerDecant ?? 0,
        mhe: editedAllocationKeys.current.has("mhe")
          ? previous.mhe
          : data.mhe ?? 1,
        frameload: editedAllocationKeys.current.has("frameload")
          ? previous.frameload
          : data.frameload ?? 3,
        bt: editedAllocationKeys.current.has("bt")
          ? previous.bt
          : data.bt ?? 2,
        vanLoad: editedAllocationKeys.current.has("vanLoad")
          ? previous.vanLoad
          : data.vanLoad ?? 1,
        dekit: editedAllocationKeys.current.has("dekit")
          ? previous.dekit
          : data.dekit ?? 1,
        totalIC: editedAllocationKeys.current.has("totalIC")
          ? previous.totalIC
          : data.totalIC ?? 2,
      }));

      setWorkInputs((previous) => {
        const next = { ...previous };

        Object.keys(emptyWorkInputs).forEach((key) => {
          if (!editedWorkInputKeys.current.has(key)) {
            next[key] = data[key] ?? "";
          }
        });

        return next;
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(PICK_DOC, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() || {};

      setWorkInputs((previous) => ({
        ...previous,
        ambientOutstanding: editedWorkInputKeys.current.has(
          "ambientOutstanding"
        )
          ? previous.ambientOutstanding
          : data.ambientOutstanding ?? "",
        chillOutstanding: editedWorkInputKeys.current.has("chillOutstanding")
          ? previous.chillOutstanding
          : data.chillOutstanding ?? "",
        ambientUPH: editedWorkInputKeys.current.has("ambientUPH")
          ? previous.ambientUPH
          : data.ambientUPH ?? "",
        chillUPH: editedWorkInputKeys.current.has("chillUPH")
          ? previous.chillUPH
          : data.chillUPH ?? "",
        pickBreakMinutes: editedWorkInputKeys.current.has("pickBreakMinutes")
          ? previous.pickBreakMinutes
          : data.ambientBreak1 ?? "",
      }));
    });

    return unsubscribe;
  }, []);

  const updateAllocation = (key, value) => {
    editedAllocationKeys.current.add(key);

    setAllocation((previous) => ({
      ...previous,
      [key]: value === "" ? "" : Math.max(0, Number(value) || 0),
    }));
  };

  const updateWorkInput = (key, value) => {
    editedWorkInputKeys.current.add(key);

    setWorkInputs((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

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

  const maxAllocation = Math.ceil(totalHours / 10);

  const staffAllocationPlan = useMemo(() => {
    let remaining = maxAllocation;

    const assignPriority = (requested) => {
      const allocated = Math.min(
        Math.max(requested, 0),
        Math.max(remaining, 0)
      );

      remaining -= allocated;
      return allocated;
    };

    const ambientPick = assignPriority(calculatedAmbientPick);
    const chillPick = assignPriority(calculatedChillPick);
    const freezerPick = assignPriority(calculatedFreezerPick);
    const mhe = assignPriority(getNumber(allocation.mhe));
    const frameload = assignPriority(getNumber(allocation.frameload));
    const bt = assignPriority(getNumber(allocation.bt));
    const vanLoad = assignPriority(getNumber(allocation.vanLoad));
    const totalIC = assignPriority(getNumber(allocation.totalIC));
    const decant = assignPriority(calculatedDecant);
    const bagging = assignPriority(calculatedBagging);
    const dekit = assignPriority(getNumber(allocation.dekit));
    const baggingRunner = assignPriority(getNumber(allocation.baggingRunner));
    const freezerDecant = assignPriority(getNumber(allocation.freezerDecant));

    return {
      ambientPick,
      chillPick,
      freezerPick,
      mhe,
      frameload,
      bt,
      vanLoad,
      totalIC,
      decant,
      bagging,
      dekit,
      baggingRunner,
      freezerDecant,
      remaining,
    };
  }, [
    maxAllocation,
    calculatedAmbientPick,
    calculatedChillPick,
    calculatedFreezerPick,
    calculatedDecant,
    calculatedBagging,
    allocation.mhe,
    allocation.frameload,
    allocation.bt,
    allocation.vanLoad,
    allocation.totalIC,
    allocation.dekit,
    allocation.baggingRunner,
    allocation.freezerDecant,
  ]);

  const totalPick =
    staffAllocationPlan.ambientPick +
    staffAllocationPlan.chillPick +
    staffAllocationPlan.bagging +
    staffAllocationPlan.baggingRunner;

  const totalFreezer =
    staffAllocationPlan.freezerPick + staffAllocationPlan.freezerDecant;

  const totalInbound =
    staffAllocationPlan.decant + staffAllocationPlan.mhe;

  const totalDispatch =
    staffAllocationPlan.frameload +
    staffAllocationPlan.bt +
    staffAllocationPlan.vanLoad +
    staffAllocationPlan.dekit;

  const totalAllocated =
    totalPick +
    totalFreezer +
    totalInbound +
    totalDispatch +
    staffAllocationPlan.totalIC;

  const totalRequested =
    calculatedAmbientPick +
    calculatedChillPick +
    calculatedBagging +
    calculatedFreezerPick +
    calculatedDecant +
    getNumber(allocation.mhe) +
    getNumber(allocation.frameload) +
    getNumber(allocation.bt) +
    getNumber(allocation.vanLoad) +
    getNumber(allocation.dekit) +
    getNumber(allocation.totalIC) +
    getNumber(allocation.baggingRunner) +
    getNumber(allocation.freezerDecant);

  const shortfall = Math.max(0, totalRequested - totalAllocated);

  useEffect(() => {
    if (shortfall <= 0) {
      shownShortfallRef.current = "";
      return;
    }

    const warningMessage =
      `Staffing requirement is higher than available teammates. ` +
      `Shortfall: ${shortfall}.`;

    if (shownShortfallRef.current === warningMessage) {
      return;
    }

    shownShortfallRef.current = warningMessage;
    showToast(warningMessage);
  }, [shortfall]);

  const saveAllocation = async () => {
    try {
      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...allocation,
          ...workInputs,
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
      initializedFromFirestore.current = false;
      editedWorkInputKeys.current = new Set();
      editedAllocationKeys.current = new Set();
      shownShortfallRef.current = "";

      setAllocation(emptyAllocation);
      setWorkInputs(emptyWorkInputs);

      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...emptyAllocation,
          ...emptyWorkInputs,
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

          <div>
            <span>Available Teammates</span>
            <strong>{maxAllocation}</strong>
          </div>

          <div className={shortfall > 0 ? "allocation-over-limit" : ""}>
            <span>Allocated Teammates</span>
            <strong>{totalAllocated}</strong>
          </div>

          <div
            className={
              staffAllocationPlan.remaining > 0
                ? ""
                : "allocation-over-limit"
            }
          >
            <span>Remaining Teammates</span>
            <strong>{staffAllocationPlan.remaining}</strong>
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
              value={staffAllocationPlan.ambientPick}
              readOnly
              calculated
            />

            <NumberField
              label="Chill Pick"
              value={staffAllocationPlan.chillPick}
              readOnly
              calculated
            />

            <NumberField
              label="Bagging"
              value={staffAllocationPlan.bagging}
              readOnly
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

          <div className="staff-group-divider">
            Pick workload details
          </div>

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

          <div className="staff-group-divider">
            Bagging workload details
          </div>

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
                updateWorkInput(
                  "baggingCompletionTime",
                  event.target.value
                )
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
              value={staffAllocationPlan.freezerPick}
              readOnly
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

          <div className="staff-group-divider">
            Freezer workload details
          </div>

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
                updateWorkInput(
                  "freezerCompletionTime",
                  event.target.value
                )
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
              value={staffAllocationPlan.decant}
              readOnly
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

          <div className="staff-group-divider">
            Inbound workload details
          </div>

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
                updateWorkInput(
                  "inboundCompletionTime",
                  event.target.value
                )
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
            <span>Total: {staffAllocationPlan.totalIC}</span>
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