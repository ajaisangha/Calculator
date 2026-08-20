import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import "./staffallocation.css";

const SHIFT_EOS_DOC = doc(db, "totes", "shiftEOS");
const STAFF_ALLOCATION_DOC = doc(db, "totes", "staffAllocation");

const staffGroups = [
  {
    name: "Pick",
    className: "pick-group",
    subGroups: [
      { key: "ambientPick", label: "Ambient Pick" },
      { key: "chillPick", label: "Chill Pick" },
      { key: "bagging", label: "Bagging" },
      { key: "baggingRunner", label: "Bagging Runner" },
      { key: "totalPick", label: "Total Pick", calculated: true },
    ],
  },
  {
    name: "Freezer",
    className: "freezer-group",
    subGroups: [
      { key: "freezerPick", label: "Freezer Pick" },
      { key: "freezerDecant", label: "Freezer Decant" },
      { key: "totalFreezer", label: "Total Freezer", calculated: true },
    ],
  },
  {
    name: "Inbound",
    className: "inbound-group",
    subGroups: [
      { key: "decant", label: "Decant" },
      { key: "mhe", label: "MHE" },
      { key: "totalInbound", label: "Total Inbound", calculated: true },
    ],
  },
  {
    name: "Dispatch",
    className: "dispatch-group",
    subGroups: [
      { key: "frameload", label: "Frameload" },
      { key: "bt", label: "BT" },
      { key: "vanLoad", label: "Van Load" },
      { key: "dekit", label: "Dekit" },
      { key: "totalDispatch", label: "Total Dispatch", calculated: true },
    ],
  },
  {
    name: "IC",
    className: "ic-group",
    subGroups: [{ key: "totalIC", label: "Total IC" }],
  },
];

const emptyAllocation = {
  ambientPick: "",
  chillPick: "",
  bagging: "",
  baggingRunner: "",
  freezerPick: "",
  freezerDecant: "",
  decant: "",
  mhe: "",
  frameload: "",
  bt: "",
  vanLoad: "",
  dekit: "",
  totalIC: "",
};

export default function StaffAllocation() {
  const [allocation, setAllocation] = useState(emptyAllocation);
  const [totalHours, setTotalHours] = useState(0);
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (message) => {
    setToast({ show: true, message });

    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 2000);
  };

  // Get Total Hours from Shift EOS Firestore document.
  useEffect(() => {
    const unsubscribe = onSnapshot(SHIFT_EOS_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        setTotalHours(0);
        return;
      }

      const data = snapshot.data() || {};
      setTotalHours(Number(data.totalHours) || 0);
    });

    return unsubscribe;
  }, []);

  // Load Staff Allocation fields from Firestore on page open / refresh.
  useEffect(() => {
    const unsubscribe = onSnapshot(STAFF_ALLOCATION_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        setAllocation(emptyAllocation);
        return;
      }

      const savedData = snapshot.data() || {};

      setAllocation({
        ambientPick: savedData.ambientPick ?? "",
        chillPick: savedData.chillPick ?? "",
        bagging: savedData.bagging ?? "",
        baggingRunner: savedData.baggingRunner ?? "",
        freezerPick: savedData.freezerPick ?? "",
        freezerDecant: savedData.freezerDecant ?? "",
        decant: savedData.decant ?? "",
        mhe: savedData.mhe ?? "",
        frameload: savedData.frameload ?? "",
        bt: savedData.bt ?? "",
        vanLoad: savedData.vanLoad ?? "",
        dekit: savedData.dekit ?? "",
        totalIC: savedData.totalIC ?? "",
      });
    });

    return unsubscribe;
  }, []);

  const updateAllocation = (key, value) => {
    if (value === "") {
      setAllocation((previous) => ({
        ...previous,
        [key]: "",
      }));
      return;
    }

    const numericValue = Math.max(0, Number(value) || 0);

    setAllocation((previous) => ({
      ...previous,
      [key]: numericValue,
    }));
  };

  const totalPick = useMemo(() => {
    return (
      (Number(allocation.ambientPick) || 0) +
      (Number(allocation.chillPick) || 0) +
      (Number(allocation.bagging) || 0) +
      (Number(allocation.baggingRunner) || 0)
    );
  }, [
    allocation.ambientPick,
    allocation.chillPick,
    allocation.bagging,
    allocation.baggingRunner,
  ]);

  const totalFreezer = useMemo(() => {
    return (
      (Number(allocation.freezerPick) || 0) +
      (Number(allocation.freezerDecant) || 0)
    );
  }, [allocation.freezerPick, allocation.freezerDecant]);

  const totalInbound = useMemo(() => {
    return (Number(allocation.decant) || 0) + (Number(allocation.mhe) || 0);
  }, [allocation.decant, allocation.mhe]);

  const totalDispatch = useMemo(() => {
    return (
      (Number(allocation.frameload) || 0) +
      (Number(allocation.bt) || 0) +
      (Number(allocation.vanLoad) || 0) +
      (Number(allocation.dekit) || 0)
    );
  }, [
    allocation.frameload,
    allocation.bt,
    allocation.vanLoad,
    allocation.dekit,
  ]);

  const totalAllocated = useMemo(() => {
    return (
      totalPick +
      totalFreezer +
      totalInbound +
      totalDispatch +
      (Number(allocation.totalIC) || 0)
    );
  }, [
    totalPick,
    totalFreezer,
    totalInbound,
    totalDispatch,
    allocation.totalIC,
  ]);

  // Math.ceil rounds up, including decimal staffing calculations.
  const maxAllocation = useMemo(() => {
    return Math.ceil(totalHours / 10);
  }, [totalHours]);

  const exceedsAllocation = maxAllocation > 0 && totalAllocated > maxAllocation;

  const calculatedValues = {
    totalPick,
    totalFreezer,
    totalInbound,
    totalDispatch,
  };

  const saveAllocation = async () => {
    try {
      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ambientPick: allocation.ambientPick,
          chillPick: allocation.chillPick,
          bagging: allocation.bagging,
          baggingRunner: allocation.baggingRunner,
          freezerPick: allocation.freezerPick,
          freezerDecant: allocation.freezerDecant,
          decant: allocation.decant,
          mhe: allocation.mhe,
          frameload: allocation.frameload,
          bt: allocation.bt,
          vanLoad: allocation.vanLoad,
          dekit: allocation.dekit,
          totalIC: allocation.totalIC,
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

      await setDoc(
        STAFF_ALLOCATION_DOC,
        {
          ambientPick: "",
          chillPick: "",
          bagging: "",
          baggingRunner: "",
          freezerPick: "",
          freezerDecant: "",
          decant: "",
          mhe: "",
          frameload: "",
          bt: "",
          vanLoad: "",
          dekit: "",
          totalIC: "",
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
            <tr>
              {staffGroups.flatMap((group) =>
                group.subGroups.map((subGroup) => {
                  if (subGroup.calculated) {
                    return (
                      <td key={subGroup.key} className="staff-total-cell">
                        <span className="staff-calculated-value">
                          {calculatedValues[subGroup.key]}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td key={subGroup.key}>
                      <label
                        className="sr-only"
                        htmlFor={`staff-${subGroup.key}`}
                      >
                        {subGroup.label}
                      </label>

                      <input
                        id={`staff-${subGroup.key}`}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={allocation[subGroup.key]}
                        onChange={(event) =>
                          updateAllocation(subGroup.key, event.target.value)
                        }
                        className="staff-allocation-input"
                        placeholder="0"
                      />
                    </td>
                  );
                })
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