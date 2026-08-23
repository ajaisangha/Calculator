import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import "./staffallocation.css";

const SHIFT_EOS_DOC = doc(db, "totes", "shiftEOS");
const PICK_DOC = doc(db, "totes", "pickCalculator");
const STAFF_ALLOCATION_DOC = doc(db, "totes", "staffAllocation");

const staffGroups = [
  {
    name: "Pick",
    className: "pick-group",
    subGroups: [
      { key: "ambientPick", label: "Ambient Pick", calculated: true },
      { key: "chillPick", label: "Chill Pick", calculated: true },
      { key: "bagging", label: "Bagging", calculated: true },
      { key: "baggingRunner", label: "Bagging Runner", editable: true },
      { key: "totalPick", label: "Total Pick", calculated: true },
    ],
  },
  {
    name: "Freezer",
    className: "freezer-group",
    subGroups: [
      { key: "freezerPick", label: "Freezer Pick", calculated: true },
      { key: "freezerDecant", label: "Freezer Decant", editable: true },
      { key: "totalFreezer", label: "Total Freezer", calculated: true },
    ],
  },
  {
    name: "Inbound",
    className: "inbound-group",
    subGroups: [
      { key: "decant", label: "Decant", calculated: true },
      { key: "mhe", label: "MHE", editable: true },
      { key: "totalInbound", label: "Total Inbound", calculated: true },
    ],
  },
  {
    name: "Dispatch",
    className: "dispatch-group",
    subGroups: [
      { key: "frameload", label: "Frameload", editable: true },
      { key: "bt", label: "BT", editable: true },
      { key: "vanLoad", label: "Van Load", editable: true },
      { key: "dekit", label: "Dekit", editable: true },
      { key: "totalDispatch", label: "Total Dispatch", calculated: true },
    ],
  },
  {
    name: "IC",
    className: "ic-group",
    subGroups: [{ key: "totalIC", label: "Total IC", editable: true }],
  },
];

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

export default function StaffAllocation() {
  const [allocation, setAllocation] = useState(emptyAllocation);
  const [totalHours, setTotalHours] = useState(0);
  const [inboundNeeded, setInboundNeeded] = useState(0);
  const [workInputs, setWorkInputs] = useState(emptyWorkInputs);
  const [toast, setToast] = useState({ show: false, message: "" });

  const initializedFromFirestore = useRef(false);
  const editedWorkInputKeys = useRef(new Set());
  const editedAllocationKeys = useRef(new Set());

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

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

  const ambientPick = staffAllocationPlan.ambientPick;
  const chillPick = staffAllocationPlan.chillPick;
  const bagging = staffAllocationPlan.bagging;
  const baggingRunner = staffAllocationPlan.baggingRunner;
  const freezerPick = staffAllocationPlan.freezerPick;
  const freezerDecant = staffAllocationPlan.freezerDecant;
  const decant = staffAllocationPlan.decant;
  const mhe = staffAllocationPlan.mhe;
  const frameload = staffAllocationPlan.frameload;
  const bt = staffAllocationPlan.bt;
  const vanLoad = staffAllocationPlan.vanLoad;
  const dekit = staffAllocationPlan.dekit;
  const totalIC = staffAllocationPlan.totalIC;

  const totalPick = ambientPick + chillPick + bagging + baggingRunner;
  const totalFreezer = freezerPick + freezerDecant;
  const totalInbound = decant + mhe;
  const totalDispatch = frameload + bt + vanLoad + dekit;

  const totalAllocated =
    totalPick + totalFreezer + totalInbound + totalDispatch + totalIC;

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

  const calculatedValues = {
    ambientPick,
    chillPick,
    bagging,
    baggingRunner,
    totalPick,
    freezerPick,
    freezerDecant,
    totalFreezer,
    decant,
    mhe,
    totalInbound,
    frameload,
    bt,
    vanLoad,
    dekit,
    totalDispatch,
    totalIC,
  };

  const editableValues = {
    baggingRunner: allocation.baggingRunner,
    freezerDecant: allocation.freezerDecant,
    mhe: allocation.mhe,
    frameload: allocation.frameload,
    bt: allocation.bt,
    vanLoad: allocation.vanLoad,
    dekit: allocation.dekit,
    totalIC: allocation.totalIC,
  };

  const saveAllocation = async () => {
    try {
      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...editableValues,
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

  const renderStaffCell = (subGroup) => {
    const allocationValue = calculatedValues[subGroup.key] ?? 0;

    if (subGroup.calculated) {
      return (
        <td key={subGroup.key} className="staff-total-cell">
          <input
            type="number"
            value={allocationValue}
            readOnly
            aria-label={`${subGroup.label} calculated allocation`}
            className="staff-allocation-input staff-calculated-input staff-readonly-input"
          />
        </td>
      );
    }

    return (
      <td key={subGroup.key}>
        <input
          id={`staff-${subGroup.key}`}
          type="number"
          min="0"
          inputMode="numeric"
          aria-label={subGroup.label}
          value={editableValues[subGroup.key]}
          onChange={(event) =>
            updateAllocation(subGroup.key, event.target.value)
          }
          className="staff-allocation-input"
          placeholder="0"
        />
      </td>
    );
  };

  return (
    <section className="data-card staff-allocation-card">
      <h2 className="data-title">Staff Allocation</h2>

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

      {shortfall > 0 && (
        <p className="allocation-warning">
          Staffing requirement is higher than available teammates. Shortfall:{" "}
          {shortfall}.
        </p>
      )}

      <div className="staff-allocation-table-wrap">
        <table className="staff-allocation-table">
          <thead>
            <tr>
              {staffGroups.map((group) => (
                <th
                  key={group.name}
                  colSpan={group.subGroups.length}
                  className={`staff-group-header ${group.className}`}
                >
                  {group.name}
                </th>
              ))}

              <th className="staff-group-header total-group">Total</th>
            </tr>

            <tr>
              {staffGroups.flatMap((group) =>
                group.subGroups.map((subGroup) => (
                  <th
                    key={subGroup.key}
                    className={`staff-subgroup-header ${
                      subGroup.calculated ? "staff-total-header" : ""
                    }`}
                  >
                    {subGroup.label}
                  </th>
                ))
              )}

              <th className="staff-subgroup-header staff-total-header">
                Total Allocation
              </th>
            </tr>
          </thead>

          <tbody>
            <tr className="staff-main-row">
              {staffGroups.flatMap((group) =>
                group.subGroups.map(renderStaffCell)
              )}

              <td className="staff-total-cell">
                <div className="staff-final-total">
                  <strong>{totalAllocated}</strong>
                  <span>/ {maxAllocation}</span>
                </div>
              </td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Ambient Outstanding</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Ambient Outstanding"
                  value={workInputs.ambientOutstanding}
                  onChange={(event) =>
                    updateWorkInput("ambientOutstanding", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Chill Outstanding</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Chill Outstanding"
                  value={workInputs.chillOutstanding}
                  onChange={(event) =>
                    updateWorkInput("chillOutstanding", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Bagging Outstanding</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Bagging Outstanding"
                  value={workInputs.baggingOutstanding}
                  onChange={(event) =>
                    updateWorkInput("baggingOutstanding", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Freezer Outstanding</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Freezer Outstanding"
                  value={workInputs.freezerOutstanding}
                  onChange={(event) =>
                    updateWorkInput("freezerOutstanding", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Inbound Needed</th>

              <td colSpan="2" className="staff-detail-value-cell">
                <span className="staff-detail-value">{inboundNeeded}</span>
              </td>

              <td colSpan="2"></td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Ambient UPH</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Ambient UPH"
                  value={workInputs.ambientUPH}
                  onChange={(event) =>
                    updateWorkInput("ambientUPH", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Chill UPH</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Chill UPH"
                  value={workInputs.chillUPH}
                  onChange={(event) =>
                    updateWorkInput("chillUPH", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Bagging UPH</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Bagging UPH"
                  value={workInputs.baggingUPH}
                  onChange={(event) =>
                    updateWorkInput("baggingUPH", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Freezer UPH</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Freezer UPH"
                  value={workInputs.freezerUPH}
                  onChange={(event) =>
                    updateWorkInput("freezerUPH", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Inbound UPH</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Inbound UPH"
                  value={workInputs.inboundUPH}
                  onChange={(event) =>
                    updateWorkInput("inboundUPH", event.target.value)
                  }
                  className="staff-wide-detail-input"
                  placeholder="0"
                />
              </td>

              <td colSpan="2"></td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Pick Break</th>

              <td colSpan="5">
                <input
                  type="number"
                  min="0"
                  aria-label="Pick Break Minutes"
                  value={workInputs.pickBreakMinutes}
                  onChange={(event) =>
                    updateWorkInput("pickBreakMinutes", event.target.value)
                  }
                  className="staff-break-input"
                  placeholder="Minutes"
                />
              </td>

              <th>Bagging Break</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Bagging Break Minutes"
                  value={workInputs.baggingBreakMinutes}
                  onChange={(event) =>
                    updateWorkInput("baggingBreakMinutes", event.target.value)
                  }
                  className="staff-break-input"
                  placeholder="Minutes"
                />
              </td>

              <th>Freezer Break</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Freezer Break Minutes"
                  value={workInputs.freezerBreakMinutes}
                  onChange={(event) =>
                    updateWorkInput("freezerBreakMinutes", event.target.value)
                  }
                  className="staff-break-input"
                  placeholder="Minutes"
                />
              </td>

              <th>Inbound Break</th>

              <td colSpan="2">
                <input
                  type="number"
                  min="0"
                  aria-label="Inbound Break Minutes"
                  value={workInputs.inboundBreakMinutes}
                  onChange={(event) =>
                    updateWorkInput("inboundBreakMinutes", event.target.value)
                  }
                  className="staff-break-input"
                  placeholder="Minutes"
                />
              </td>

              <td colSpan="2"></td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Pick Completion</th>

              <td colSpan="5">
                <input
                  type="time"
                  aria-label="Pick Completion Time"
                  value={workInputs.pickCompletionTime}
                  onChange={(event) =>
                    updateWorkInput("pickCompletionTime", event.target.value)
                  }
                  className="staff-time-input"
                />
              </td>

              <th>Bagging Completion</th>

              <td colSpan="2">
                <input
                  type="time"
                  aria-label="Bagging Completion Time"
                  value={workInputs.baggingCompletionTime}
                  onChange={(event) =>
                    updateWorkInput(
                      "baggingCompletionTime",
                      event.target.value
                    )
                  }
                  className="staff-time-input"
                />
              </td>

              <th>Freezer Completion</th>

              <td colSpan="2">
                <input
                  type="time"
                  aria-label="Freezer Completion Time"
                  value={workInputs.freezerCompletionTime}
                  onChange={(event) =>
                    updateWorkInput(
                      "freezerCompletionTime",
                      event.target.value
                    )
                  }
                  className="staff-time-input"
                />
              </td>

              <th>Inbound Completion</th>

              <td colSpan="2">
                <input
                  type="time"
                  aria-label="Inbound Completion Time"
                  value={workInputs.inboundCompletionTime}
                  onChange={(event) =>
                    updateWorkInput(
                      "inboundCompletionTime",
                      event.target.value
                    )
                  }
                  className="staff-time-input"
                />
              </td>

              <td colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="staff-allocation-actions">
        <button className="calculate-btn" onClick={saveAllocation}>
          Save
        </button>

        <button className="clear-btn" onClick={clearAllocation}>
          Clear
        </button>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}