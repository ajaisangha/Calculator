import React, { useEffect, useMemo, useState } from "react";
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
  pickCompletionTime: "",

  baggingOutstanding: "",
  baggingUPH: "",
  baggingCompletionTime: "",

  freezerOutstanding: "",
  freezerUPH: "",
  freezerCompletionTime: "",

  inboundUPH: "",
  inboundCompletionTime: "",
};

const emptyCalculatedOverrides = {
  ambientPick: "",
  chillPick: "",
  bagging: "",
  totalPick: "",
  freezerPick: "",
  totalFreezer: "",
  decant: "",
  totalInbound: "",
  totalDispatch: "",
};

function getNumber(value) {
  return Number(value) || 0;
}

function getHoursUntilCompletion(completionTime) {
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

  return (completion.getTime() - now.getTime()) / 3600000;
}

function calculateRequiredStaff(outstanding, uph, completionTime) {
  const totalOutstanding = getNumber(outstanding);
  const rate = getNumber(uph);
  const hoursLeft = getHoursUntilCompletion(completionTime);

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
  const [calculatedOverrides, setCalculatedOverrides] = useState(
    emptyCalculatedOverrides
  );
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (message) => {
    setToast({ show: true, message });

    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 2000);
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
    const unsubscribe = onSnapshot(PICK_DOC, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() || {};

      setWorkInputs((previous) => ({
        ...previous,
        ambientOutstanding:
          previous.ambientOutstanding !== ""
            ? previous.ambientOutstanding
            : data.ambientOutstanding ?? "",
        chillOutstanding:
          previous.chillOutstanding !== ""
            ? previous.chillOutstanding
            : data.chillOutstanding ?? "",
        ambientUPH:
          previous.ambientUPH !== ""
            ? previous.ambientUPH
            : data.ambientUPH ?? "",
        chillUPH:
          previous.chillUPH !== ""
            ? previous.chillUPH
            : data.chillUPH ?? "",
      }));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(STAFF_ALLOCATION_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        setAllocation(emptyAllocation);
        setWorkInputs(emptyWorkInputs);
        setCalculatedOverrides(emptyCalculatedOverrides);
        return;
      }

      const data = snapshot.data() || {};

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
        pickCompletionTime: data.pickCompletionTime ?? "",

        baggingOutstanding: data.baggingOutstanding ?? "",
        baggingUPH: data.baggingUPH ?? "",
        baggingCompletionTime: data.baggingCompletionTime ?? "",

        freezerOutstanding: data.freezerOutstanding ?? "",
        freezerUPH: data.freezerUPH ?? "",
        freezerCompletionTime: data.freezerCompletionTime ?? "",

        inboundUPH: data.inboundUPH ?? "",
        inboundCompletionTime: data.inboundCompletionTime ?? "",
      });

      setCalculatedOverrides({
        ambientPick: data.ambientPickOverride ?? "",
        chillPick: data.chillPickOverride ?? "",
        bagging: data.baggingOverride ?? "",
        totalPick: data.totalPickOverride ?? "",
        freezerPick: data.freezerPickOverride ?? "",
        totalFreezer: data.totalFreezerOverride ?? "",
        decant: data.decantOverride ?? "",
        totalInbound: data.totalInboundOverride ?? "",
        totalDispatch: data.totalDispatchOverride ?? "",
      });
    });

    return unsubscribe;
  }, []);

  const updateAllocation = (key, value) => {
    setAllocation((previous) => ({
      ...previous,
      [key]: value === "" ? "" : Math.max(0, Number(value) || 0),
    }));
  };

  const updateWorkInput = (key, value) => {
    setWorkInputs((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateCalculatedOverride = (key, value) => {
    setCalculatedOverrides((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const calculatedAmbientPick = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.ambientOutstanding,
        workInputs.ambientUPH,
        workInputs.pickCompletionTime
      ),
    [
      workInputs.ambientOutstanding,
      workInputs.ambientUPH,
      workInputs.pickCompletionTime,
    ]
  );

  const calculatedChillPick = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.chillOutstanding,
        workInputs.chillUPH,
        workInputs.pickCompletionTime
      ),
    [
      workInputs.chillOutstanding,
      workInputs.chillUPH,
      workInputs.pickCompletionTime,
    ]
  );

  const calculatedBagging = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.baggingOutstanding,
        workInputs.baggingUPH,
        workInputs.baggingCompletionTime
      ),
    [
      workInputs.baggingOutstanding,
      workInputs.baggingUPH,
      workInputs.baggingCompletionTime,
    ]
  );

  const calculatedFreezerPick = useMemo(
    () =>
      calculateRequiredStaff(
        workInputs.freezerOutstanding,
        workInputs.freezerUPH,
        workInputs.freezerCompletionTime
      ),
    [
      workInputs.freezerOutstanding,
      workInputs.freezerUPH,
      workInputs.freezerCompletionTime,
    ]
  );

  const calculatedDecant = useMemo(
    () =>
      calculateRequiredStaff(
        inboundNeeded,
        workInputs.inboundUPH,
        workInputs.inboundCompletionTime
      ),
    [inboundNeeded, workInputs.inboundUPH, workInputs.inboundCompletionTime]
  );

  const ambientPick = getNumber(
    calculatedOverrides.ambientPick !== ""
      ? calculatedOverrides.ambientPick
      : calculatedAmbientPick
  );

  const chillPick = getNumber(
    calculatedOverrides.chillPick !== ""
      ? calculatedOverrides.chillPick
      : calculatedChillPick
  );

  const bagging = getNumber(
    calculatedOverrides.bagging !== ""
      ? calculatedOverrides.bagging
      : calculatedBagging
  );

  const freezerPick = getNumber(
    calculatedOverrides.freezerPick !== ""
      ? calculatedOverrides.freezerPick
      : calculatedFreezerPick
  );

  const decant = getNumber(
    calculatedOverrides.decant !== ""
      ? calculatedOverrides.decant
      : calculatedDecant
  );

  const calculatedTotalPick =
    ambientPick +
    chillPick +
    bagging +
    getNumber(allocation.baggingRunner);

  const totalPick = getNumber(
    calculatedOverrides.totalPick !== ""
      ? calculatedOverrides.totalPick
      : calculatedTotalPick
  );

  const calculatedTotalFreezer =
    freezerPick + getNumber(allocation.freezerDecant);

  const totalFreezer = getNumber(
    calculatedOverrides.totalFreezer !== ""
      ? calculatedOverrides.totalFreezer
      : calculatedTotalFreezer
  );

  const calculatedTotalInbound = decant + getNumber(allocation.mhe);

  const totalInbound = getNumber(
    calculatedOverrides.totalInbound !== ""
      ? calculatedOverrides.totalInbound
      : calculatedTotalInbound
  );

  const calculatedTotalDispatch =
    getNumber(allocation.frameload) +
    getNumber(allocation.bt) +
    getNumber(allocation.vanLoad) +
    getNumber(allocation.dekit);

  const totalDispatch = getNumber(
    calculatedOverrides.totalDispatch !== ""
      ? calculatedOverrides.totalDispatch
      : calculatedTotalDispatch
  );

  const totalAllocated =
    totalPick +
    totalFreezer +
    totalInbound +
    totalDispatch +
    getNumber(allocation.totalIC);

  const maxAllocation = Math.ceil(totalHours / 10);

  const exceedsAllocation =
    maxAllocation > 0 && totalAllocated > maxAllocation;

  const calculatedValues = {
    ambientPick,
    chillPick,
    bagging,
    totalPick,
    freezerPick,
    totalFreezer,
    decant,
    totalInbound,
    totalDispatch,
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

  const overrideKeyMap = {
    ambientPick: "ambientPick",
    chillPick: "chillPick",
    bagging: "bagging",
    totalPick: "totalPick",
    freezerPick: "freezerPick",
    totalFreezer: "totalFreezer",
    decant: "decant",
    totalInbound: "totalInbound",
    totalDispatch: "totalDispatch",
  };

  const saveAllocation = async () => {
    try {
      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...editableValues,
          ...workInputs,

          ambientPickOverride: calculatedOverrides.ambientPick,
          chillPickOverride: calculatedOverrides.chillPick,
          baggingOverride: calculatedOverrides.bagging,
          totalPickOverride: calculatedOverrides.totalPick,
          freezerPickOverride: calculatedOverrides.freezerPick,
          totalFreezerOverride: calculatedOverrides.totalFreezer,
          decantOverride: calculatedOverrides.decant,
          totalInboundOverride: calculatedOverrides.totalInbound,
          totalDispatchOverride: calculatedOverrides.totalDispatch,
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
      setAllocation(emptyAllocation);
      setWorkInputs(emptyWorkInputs);
      setCalculatedOverrides(emptyCalculatedOverrides);

      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ...emptyAllocation,
          ...emptyWorkInputs,

          ambientPickOverride: "",
          chillPickOverride: "",
          baggingOverride: "",
          totalPickOverride: "",
          freezerPickOverride: "",
          totalFreezerOverride: "",
          decantOverride: "",
          totalInboundOverride: "",
          totalDispatchOverride: "",
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
    if (subGroup.calculated) {
      const overrideKey = overrideKeyMap[subGroup.key];
      const currentOverride = calculatedOverrides[overrideKey];

      return (
        <td key={subGroup.key} className="staff-total-cell">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label={`${subGroup.label} allocation`}
            value={
              currentOverride !== ""
                ? currentOverride
                : calculatedValues[subGroup.key]
            }
            onChange={(event) =>
              updateCalculatedOverride(overrideKey, event.target.value)
            }
            className="staff-allocation-input staff-calculated-input"
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
          <span>Maximum Staff Allocation</span>
          <strong>{maxAllocation}</strong>
        </div>

        <div className={exceedsAllocation ? "allocation-over-limit" : ""}>
          <span>Total Allocated</span>
          <strong>{totalAllocated}</strong>
        </div>
      </div>

      {exceedsAllocation && (
        <p className="allocation-warning">
          Total allocation exceeds the allowed maximum of {maxAllocation}.
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

              <td
                className={`staff-total-cell ${
                  exceedsAllocation ? "staff-total-over-limit" : ""
                }`}
              >
                <div className="staff-final-total">
                  <strong>{totalAllocated}</strong>
                  <span>/ {maxAllocation}</span>
                </div>
              </td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Pick Outstanding</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Ambient Outstanding"
                  value={workInputs.ambientOutstanding}
                  onChange={(event) =>
                    updateWorkInput("ambientOutstanding", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Chill Outstanding"
                  value={workInputs.chillOutstanding}
                  onChange={(event) =>
                    updateWorkInput("chillOutstanding", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Bagging Outstanding</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Bagging Outstanding"
                  value={workInputs.baggingOutstanding}
                  onChange={(event) =>
                    updateWorkInput("baggingOutstanding", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Freezer Outstanding</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Freezer Outstanding"
                  value={workInputs.freezerOutstanding}
                  onChange={(event) =>
                    updateWorkInput("freezerOutstanding", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Inbound Needed</th>

              <td className="staff-detail-value">{inboundNeeded}</td>

              <td colSpan="9"></td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Pick UPH</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Ambient UPH"
                  value={workInputs.ambientUPH}
                  onChange={(event) =>
                    updateWorkInput("ambientUPH", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Chill UPH"
                  value={workInputs.chillUPH}
                  onChange={(event) =>
                    updateWorkInput("chillUPH", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Bagging UPH</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Bagging UPH"
                  value={workInputs.baggingUPH}
                  onChange={(event) =>
                    updateWorkInput("baggingUPH", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Freezer UPH</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Freezer UPH"
                  value={workInputs.freezerUPH}
                  onChange={(event) =>
                    updateWorkInput("freezerUPH", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <th>Inbound UPH</th>

              <td>
                <input
                  type="number"
                  min="0"
                  aria-label="Inbound UPH"
                  value={workInputs.inboundUPH}
                  onChange={(event) =>
                    updateWorkInput("inboundUPH", event.target.value)
                  }
                  className="staff-detail-input"
                  placeholder="0"
                />
              </td>

              <td colSpan="9"></td>
            </tr>

            <tr className="staff-work-detail-row">
              <th>Pick Completion</th>

              <td colSpan="2">
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

              <td colSpan="6"></td>
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