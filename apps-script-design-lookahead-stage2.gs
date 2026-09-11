/* ================================================================
   DESIGN LOOK-AHEAD REGISTER V1 – SHARED GOOGLE SHEET BACKEND
   Add these functions to the current Apps Script Code.gs.
   Also add the two apiDispatch_ cases shown at the bottom of this file.
================================================================ */

function ensureDesignLookAheadSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("Design Look-Ahead");
  if (!sheet) sheet = ss.insertSheet("Design Look-Ahead");

  const headers = [
    "Look-Ahead ID",
    "Project",
    "Upcoming Site Activity",
    "Requirement Type",
    "Required Design Input / Deliverable",
    "Tower / Area",
    "Floor / Location",
    "Required at Site",
    "Responsible Party",
    "Status",
    "Priority",
    "Linked Drawing Ref.",
    "Linked Issue / RFI Ref.",
    "Linked Change Ref.",
    "Action / Decision Owner",
    "Remarks / Required Action",
    "Created By",
    "Created At",
    "Updated By",
    "Updated At"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function designLookAheadDate_(value, tz) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? String(value) : Utilities.formatDate(d, tz, "yyyy-MM-dd");
}

function designLookAheadRowToObject_(row, tz) {
  return {
    id: row[0] || "",
    project: row[1] || "",
    activity: row[2] || "",
    requirement: row[3] || "Drawing",
    deliverable: row[4] || "",
    tower: row[5] || "",
    floor: row[6] || "",
    requiredDate: designLookAheadDate_(row[7], tz),
    responsible: row[8] || "",
    status: row[9] || "Planned",
    priority: row[10] || "Normal",
    drawingRef: row[11] || "",
    issueRef: row[12] || "",
    changeRef: row[13] || "",
    owner: row[14] || "",
    remarks: row[15] || "",
    createdBy: row[16] || "",
    createdAt: formatAdminDate_(row[17], tz),
    updatedBy: row[18] || "",
    updatedAt: formatAdminDate_(row[19], tz)
  };
}

function findDesignLookAheadRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === String(id || "").trim()) return i + 2;
  }
  return -1;
}

function validateDesignLookAheadPayload_(payload) {
  ["project", "activity", "requirement", "deliverable", "requiredDate", "responsible"].forEach(function(k) {
    if (!String(payload[k] || "").trim()) throw new Error("Mandatory Design Look-Ahead field missing: " + k);
  });

  const requirements = ["Drawing","Design Decision","Approval","RFI / Clarification","Design Change","Material / Finish Selection","Coordination"];
  if (requirements.indexOf(String(payload.requirement || "Drawing").trim()) === -1) throw new Error("Invalid Look-Ahead requirement type.");

  const statuses = ["Planned","In Progress","At Risk","Ready","Closed"];
  if (statuses.indexOf(String(payload.status || "Planned").trim()) === -1) throw new Error("Invalid Look-Ahead status.");

  const priorities = ["Normal","High","Critical"];
  if (priorities.indexOf(String(payload.priority || "Normal").trim()) === -1) throw new Error("Invalid Look-Ahead priority.");

  const requiredDate = parseSheetInputDate_(payload.requiredDate);
  if (!requiredDate) throw new Error("Valid Required at Site date is required.");
  return { requiredDate: requiredDate };
}

function getDesignLookAhead(userId, username) {
  const user = assertActiveUser_(userId, username);
  const sheet = ensureDesignLookAheadSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const tz = Session.getScriptTimeZone();
  return values.slice(1)
    .filter(function(row) {
      return String(row[0] || "").trim() !== "" && userCanAccessProject_(user, row[1]);
    })
    .map(function(row) { return designLookAheadRowToObject_(row, tz); })
    .sort(function(a, b) {
      const aClosed = ["Ready","Closed"].indexOf(a.status) !== -1;
      const bClosed = ["Ready","Closed"].indexOf(b.status) !== -1;
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      return String(a.requiredDate || "9999-12-31").localeCompare(String(b.requiredDate || "9999-12-31"));
    });
}

function saveDesignLookAhead(payload) {
  payload = payload || {};
  const user = assertActiveUser_(payload.actorUserId, payload.actorUsername);
  assertProjectAccess_(user, payload.project);

  const dates = validateDesignLookAheadPayload_(payload);
  const sheet = ensureDesignLookAheadSheet_();
  const now = new Date();

  /* Client generates a stable ID before the POST. This makes repeated/replayed
     requests idempotent: the same ID updates the same row instead of appending. */
  let id = String(payload.id || "").trim();
  if (!id) id = "DLA-" + Utilities.getUuid().substring(0, 10).toUpperCase();
  let row = findDesignLookAheadRow_(sheet, id);

  if (row !== -1) {
    const existingProject = String(sheet.getRange(row, 2).getValue() || "").trim();
    if (existingProject) assertProjectAccess_(user, existingProject);
  }

  const rowValues = [
    String(payload.project || "").trim(),
    String(payload.activity || "").trim(),
    String(payload.requirement || "Drawing").trim(),
    String(payload.deliverable || "").trim(),
    String(payload.tower || "").trim(),
    String(payload.floor || "").trim(),
    dates.requiredDate,
    String(payload.responsible || "").trim(),
    String(payload.status || "Planned").trim(),
    String(payload.priority || "Normal").trim(),
    String(payload.drawingRef || "").trim(),
    String(payload.issueRef || "").trim(),
    String(payload.changeRef || "").trim(),
    String(payload.owner || "").trim(),
    String(payload.remarks || "").trim()
  ];

  if (row !== -1) {
    sheet.getRange(row, 2, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(row, 19, 1, 2).setValues([[user.username, now]]);
    return {success:true,id:id,updated:true,message:"Design Look-Ahead item updated successfully."};
  }

  sheet.appendRow([id].concat(rowValues).concat([user.username, now, user.username, now]));
  return {success:true,id:id,updated:false,message:"Design Look-Ahead item created successfully."};
}

function setupDesignLookAheadRegister() {
  const sheet = ensureDesignLookAheadSheet_();
  return {success:true,sheet:sheet.getName(),columns:sheet.getLastColumn(),message:"Design Look-Ahead register is ready."};
}

/* ----------------------------------------------------------------
   ADD THESE TWO CASES INSIDE apiDispatch_(request), after apiRequireUser_
   has resolved `user`, alongside Design Issues / Design Changes cases:

    case "designLookAhead":
      return getDesignLookAhead(user.userId, user.username);

    case "saveDesignLookAhead":
      data.actorUserId = user.userId;
      data.actorUsername = user.username;
      return saveDesignLookAhead(data);
---------------------------------------------------------------- */