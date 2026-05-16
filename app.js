const API_URL = "https://script.google.com/macros/s/AKfycbxsVTdu0m6QROTdid8wuByIpaRIGRhAYKP4Hki9E9uKQnUeOFVXCBHtav_WtolvZE8E/exec";
const API_KEY = "123456";

let currentUser = null;
let classes = [];
let attendanceStudents = [];
let reportData = [];

/* INIT */

window.onload = async () => {
  setToday();

  const saved = localStorage.getItem("attendanceUser");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      await openApp();
    } catch (err) {
      localStorage.removeItem("attendanceUser");
    }
  }
};

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  setIfExist("attDate", today);
  setIfExist("reportDate", today);
}

function setIfExist(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/* HELPERS */

function value(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : "";
}

function cleanId(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^0+/, "");
}

function cleanClass(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/\//g, "-")
    .toUpperCase();
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getClassName(classId) {
  const found = classes.find(c => cleanClass(c.classId) === cleanClass(classId));
  return found ? found.className : classId;
}

/* LOADING */

function showLoading(text = "กำลังประมวลผล...") {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;

  const title = overlay.querySelector(".fw-bold");
  if (title) title.innerText = text;

  overlay.classList.remove("d-none");
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;

  overlay.classList.add("d-none");
}

/* API */

async function apiGet(action, params = {}) {
  showLoading("กำลังโหลดข้อมูล...");

  try {
    const url = new URL(API_URL);
    url.searchParams.append("key", API_KEY);
    url.searchParams.append("action", action);

    Object.keys(params).forEach(k => {
      url.searchParams.append(k, params[k]);
    });

    const res = await fetch(url);
    return await res.json();

  } catch (err) {
    Swal.fire("ผิดพลาด", "เชื่อมต่อระบบไม่ได้", "error");
    return { success: false, message: err.message };

  } finally {
    hideLoading();
  }
}

async function apiPost(data) {
  showLoading("กำลังบันทึกข้อมูล...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        ...data,
        key: API_KEY
      })
    });

    return await res.json();

  } catch (err) {
    Swal.fire("ผิดพลาด", "เชื่อมต่อระบบไม่ได้", "error");
    return { success: false, message: err.message };

  } finally {
    hideLoading();
  }
}

/* LOGIN */

async function login() {
  const username = value("username");
  const password = value("password");

  if (!username || !password) {
    Swal.fire("แจ้งเตือน", "กรุณากรอก Username และ Password", "warning");
    return;
  }

  const result = await apiGet("login", { username, password });

  if (!result.success) {
    Swal.fire("เข้าสู่ระบบไม่สำเร็จ", result.message || "ข้อมูลไม่ถูกต้อง", "error");
    return;
  }

  currentUser = result.user;
  localStorage.setItem("attendanceUser", JSON.stringify(currentUser));

  await openApp();

  Swal.fire({
    icon: "success",
    title: "เข้าสู่ระบบสำเร็จ",
    timer: 1200,
    showConfirmButton: false
  });
}

function logout() {
  Swal.fire({
    title: "ออกจากระบบ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "ออก",
    cancelButtonText: "ยกเลิก"
  }).then(result => {
    if (result.isConfirmed) {
      localStorage.removeItem("attendanceUser");
      location.reload();
    }
  });
}

async function openApp() {
  document.getElementById("loginPage").classList.add("d-none");
  document.getElementById("appPage").classList.remove("d-none");

  document.getElementById("userInfo").innerText =
    currentUser ? `${currentUser.fullName}` : "";

  await loadClasses();
  showPage("attendancePage");
}

/* PAGE */

function showPage(id) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("d-none");
  });

  const page = document.getElementById(id);
  if (page) page.classList.remove("d-none");
}

/* CLASSES */

async function loadClasses() {
  const result = await apiGet("getClasses");

  if (!result.success) {
    Swal.fire("ผิดพลาด", result.message || "โหลดห้องเรียนไม่สำเร็จ", "error");
    return;
  }

  classes = result.data || [];

  fillClassSelect("attClass");
  fillClassSelect("studentClass");
  fillClassSelect("importClass");
  fillClassSelect("reportClass");

  renderClassList();
}

function fillClassSelect(id) {
  const select = document.getElementById(id);
  if (!select) return;

  select.innerHTML = `<option value="">-- เลือกห้องเรียน --</option>`;

  classes.forEach(c => {
    select.innerHTML += `
      <option value="${escapeHtml(c.classId)}">
        ${escapeHtml(c.className)}
      </option>
    `;
  });
}

async function addClass() {
  const className = value("className");

  if (!className) {
    Swal.fire("แจ้งเตือน", "กรุณากรอกชื่อห้องเรียน", "warning");
    return;
  }

  const result = await apiPost({
    action: "addClass",
    className
  });

  if (result.success) {
    document.getElementById("className").value = "";
    await loadClasses();
    Swal.fire("สำเร็จ", result.message || "เพิ่มห้องเรียนเรียบร้อย", "success");
  } else {
    Swal.fire("ผิดพลาด", result.message || "เพิ่มห้องเรียนไม่สำเร็จ", "error");
  }
}

function renderClassList() {
  const box = document.getElementById("classList");
  if (!box) return;

  if (classes.length === 0) {
    box.innerHTML = `<div class="alert alert-warning">ยังไม่มีห้องเรียน</div>`;
    return;
  }

  box.innerHTML = "";

  classes.forEach(c => {
    box.innerHTML += `
      <div class="student-item d-flex justify-content-between align-items-center">
        <div>
          <b>${escapeHtml(c.className)}</b>
          <div class="small text-muted">${escapeHtml(c.classId)}</div>
        </div>

        <button class="btn btn-sm btn-outline-danger"
          onclick="deleteClass('${escapeHtml(c.classId)}')">
          <i class="bi bi-trash"></i>
          ลบ
        </button>
      </div>
    `;
  });
}

async function deleteClass(classId) {
  const confirm = await Swal.fire({
    title: "ลบห้องเรียน?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก"
  });

  if (!confirm.isConfirmed) return;

  const result = await apiPost({
    action: "deleteClass",
    classId
  });

  if (result.success) {
    await loadClasses();
    Swal.fire("สำเร็จ", result.message || "ลบห้องเรียนเรียบร้อย", "success");
  } else {
    Swal.fire("ผิดพลาด", result.message || "ลบห้องเรียนไม่สำเร็จ", "error");
  }
}

/* STUDENTS */

async function addStudent() {
  const data = {
    action: "addStudent",
    classId: value("studentClass"),
    no: value("studentNo"),
    studentId: value("studentId"),
    prefix: value("prefix"),
    firstName: value("firstName"),
    lastName: value("lastName")
  };

  if (!data.classId || !data.no || !data.studentId || !data.prefix || !data.firstName || !data.lastName) {
    Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบ", "warning");
    return;
  }

  const result = await apiPost(data);

  if (result.success) {
    Swal.fire("สำเร็จ", result.message || "เพิ่มนักเรียนเรียบร้อย", "success");
    clearStudentForm();
    await loadStudentsManage();
  } else {
    Swal.fire("ผิดพลาด", result.message || "เพิ่มนักเรียนไม่สำเร็จ", "error");
  }
}

function clearStudentForm() {
  ["studentNo", "studentId", "prefix", "firstName", "lastName"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function loadStudentsManage() {
  const classId = value("studentClass");

  if (!classId) {
    Swal.fire("แจ้งเตือน", "กรุณาเลือกห้องเรียน", "warning");
    return;
  }

  const result = await apiGet("getStudents", { classId });
  const box = document.getElementById("studentList");

  if (!box) return;

  if (!result.success) {
    box.innerHTML = `<div class="alert alert-danger">โหลดข้อมูลไม่สำเร็จ</div>`;
    return;
  }

  const students = result.data || [];

  if (students.length === 0) {
    box.innerHTML = `<div class="alert alert-warning">ยังไม่มีนักเรียน</div>`;
    return;
  }

  box.innerHTML = "";

  students.forEach(s => {
    box.innerHTML += `
      <div class="student-item d-flex justify-content-between align-items-center">
        <div>
          <b>${escapeHtml(s.no)}. ${escapeHtml(s.prefix)}${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b>
          <div class="small text-muted">${escapeHtml(s.studentId)}</div>
        </div>

        <button class="btn btn-sm btn-outline-danger"
          onclick="deleteStudent('${escapeHtml(s.studentId)}')">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
  });
}

async function deleteStudent(studentId) {
  const confirm = await Swal.fire({
    title: "ลบนักเรียน?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก"
  });

  if (!confirm.isConfirmed) return;

  const result = await apiPost({
    action: "deleteStudent",
    studentId
  });

  if (result.success) {
    Swal.fire("สำเร็จ", result.message || "ลบนักเรียนเรียบร้อย", "success");
    await loadStudentsManage();
  } else {
    Swal.fire("ผิดพลาด", result.message || "ลบนักเรียนไม่สำเร็จ", "error");
  }
}

/* ATTENDANCE */

async function loadStudentsForAttendance() {
  const classId = value("attClass");

  if (!classId) {
    Swal.fire("แจ้งเตือน", "กรุณาเลือกห้องเรียน", "warning");
    return;
  }

  const result = await apiGet("getStudents", { classId });

  if (!result.success) {
    Swal.fire("ผิดพลาด", result.message || "โหลดรายชื่อนักเรียนไม่สำเร็จ", "error");
    return;
  }

  attendanceStudents = (result.data || []).map(s => ({
    ...s,
    attStatus: "มา",
    note: ""
  }));

  renderAttendanceList();
}

function renderAttendanceList() {
  const box = document.getElementById("attendanceList");
  if (!box) return;

  if (attendanceStudents.length === 0) {
    box.innerHTML = `<div class="alert alert-warning">ไม่พบนักเรียน</div>`;
    return;
  }

  box.innerHTML = "";

  attendanceStudents.forEach((s, i) => {
    box.innerHTML += `
      <div class="student-item">
        <div class="d-flex justify-content-between">
          <div>
            <b>${escapeHtml(s.no)}. ${escapeHtml(s.prefix)}${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b>
            <div class="small text-muted">${escapeHtml(s.studentId)}</div>
          </div>

          <span class="badge text-bg-primary">${escapeHtml(s.attStatus)}</span>
        </div>

        <div class="status-row">
          ${statusButton(i, "มา", "success")}
          ${statusButton(i, "สาย", "warning")}
          ${statusButton(i, "ขาด", "danger")}
          ${statusButton(i, "ลา", "secondary")}
        </div>

        <input class="form-control form-control-sm mt-2"
          placeholder="หมายเหตุ"
          value="${escapeHtml(s.note)}"
          onchange="setNote(${i}, this.value)">
      </div>
    `;
  });
}

function statusButton(i, status, color) {
  const active = attendanceStudents[i].attStatus === status;

  return `
    <button class="btn btn-${active ? color : "outline-" + color} status-btn"
      onclick="setStatus(${i}, '${status}')">
      ${status}
    </button>
  `;
}

function setStatus(i, status) {
  attendanceStudents[i].attStatus = status;
  renderAttendanceList();
}

function setNote(i, note) {
  attendanceStudents[i].note = note;
}

async function saveAttendance() {
  const date = value("attDate");
  const classId = value("attClass");

  if (!date || !classId) {
    Swal.fire("แจ้งเตือน", "กรุณาเลือกวันที่และห้องเรียน", "warning");
    return;
  }

  if (attendanceStudents.length === 0) {
    Swal.fire("แจ้งเตือน", "กรุณาโหลดรายชื่อนักเรียน", "warning");
    return;
  }

  const result = await apiPost({
    action: "saveAttendance",
    date,
    classId,
    teacherId: currentUser.userId,
    records: attendanceStudents.map(s => ({
      studentId: s.studentId,
      status: s.attStatus,
      note: s.note || ""
    }))
  });

  if (result.success) {
    Swal.fire("สำเร็จ", result.message || "บันทึกการเช็คชื่อเรียบร้อย", "success");
  } else {
    Swal.fire("ผิดพลาด", result.message || "บันทึกไม่สำเร็จ", "error");
  }
}

/* IMPORT EXCEL */

function importExcel() {
  const classId = value("importClass");
  const input = document.getElementById("excelFile");
  const file = input ? input.files[0] : null;

  if (!classId || !file) {
    Swal.fire("แจ้งเตือน", "กรุณาเลือกห้องเรียนและไฟล์ Excel", "warning");
    return;
  }

  showLoading("กำลังอ่านไฟล์ Excel...");

  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);

      const workbook = XLSX.read(data, {
        type: "array"
      });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
      });

      const students = rows
        .map(r => normalizeStudentRow(r))
        .filter(s => s.studentId && s.firstName);

      hideLoading();

      if (students.length === 0) {
        Swal.fire("ไม่พบข้อมูล", "กรุณาตรวจสอบหัวตาราง Excel", "warning");
        return;
      }

      const confirm = await Swal.fire({
        title: "ยืนยันนำเข้า?",
        text: `พบนักเรียน ${students.length} คน ต้องการนำเข้าหรือไม่`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "นำเข้า",
        cancelButtonText: "ยกเลิก"
      });

      if (!confirm.isConfirmed) return;

      const result = await apiPost({
        action: "importStudents",
        classId,
        students
      });

      if (result.success) {
        Swal.fire(
          "สำเร็จ",
          `นำเข้า ${result.count || students.length} คนเรียบร้อย`,
          "success"
        );

        if (input) input.value = "";

      } else {
        Swal.fire("ผิดพลาด", result.message || "นำเข้าไม่สำเร็จ", "error");
      }

    } catch (err) {
      hideLoading();
      Swal.fire("ผิดพลาด", "อ่านไฟล์ Excel ไม่สำเร็จ", "error");
    }
  };

  reader.onerror = function() {
    hideLoading();
    Swal.fire("ผิดพลาด", "ไม่สามารถอ่านไฟล์ได้", "error");
  };

  reader.readAsArrayBuffer(file);
}

function normalizeStudentRow(r) {
  const no =
    r["เลขที่"] ||
    r["no"] ||
    r["No"] ||
    r["NO"] ||
    "";

  const studentId =
    r["เลขประจำตัว"] ||
    r["เลขประจำตัวนักเรียน"] ||
    r["รหัสนักเรียน"] ||
    r["studentId"] ||
    r["StudentID"] ||
    "";

  const prefix =
    r["คำนำหน้า"] ||
    r["prefix"] ||
    "";

  let firstName =
    r["ชื่อ"] ||
    r["firstName"] ||
    "";

  let lastName =
    r["นามสกุล"] ||
    r["lastName"] ||
    "";

  const fullName =
    r["ชื่อ-สกุล"] ||
    r["ชื่อสกุล"] ||
    r["ชื่อ นามสกุล"] ||
    r["fullname"] ||
    r["fullName"] ||
    "";

  if ((!firstName || !lastName) && fullName) {
    const parts = String(fullName).trim().split(/\s+/);
    firstName = firstName || parts[0] || "";
    lastName = lastName || parts.slice(1).join(" ");
  }

  return {
    no: String(no).trim(),
    studentId: cleanId(studentId),
    prefix: String(prefix).trim(),
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim()
  };
}

/* REPORT */

async function loadReport() {
  const date = value("reportDate");
  const classId = value("reportClass");

  if (!date || !classId) {
    Swal.fire("แจ้งเตือน", "กรุณาเลือกวันที่และห้องเรียน", "warning");
    return;
  }

  const result = await apiGet("getReport", { date, classId });

  if (!result.success) {
    Swal.fire("ผิดพลาด", result.message || "โหลดรายงานไม่สำเร็จ", "error");
    return;
  }

  reportData = result.data || [];

  console.log("REPORT DEBUG:", result);

  if (result.attendanceCount === 0) {
    Swal.fire(
      "ยังไม่พบข้อมูลเช็คชื่อ",
      "ระบบพบรายชื่อนักเรียน แต่ไม่พบข้อมูลใน Attendance ของวันที่/ห้องนี้",
      "warning"
    );
  }

  renderReport();
}

function renderReport() {
  const summaryBox = document.getElementById("reportSummary");
  const tableBox = document.getElementById("reportTable");

  if (!summaryBox || !tableBox) return;

  if (reportData.length === 0) {
    summaryBox.innerHTML = "";
    tableBox.innerHTML = `<div class="alert alert-warning">ไม่พบข้อมูล</div>`;
    return;
  }

  const count = {
    มา: reportData.filter(r => r.status === "มา").length,
    สาย: reportData.filter(r => r.status === "สาย").length,
    ขาด: reportData.filter(r => r.status === "ขาด").length,
    ลา: reportData.filter(r => r.status === "ลา").length,
    ยังไม่เช็ค: reportData.filter(r => r.status === "ยังไม่เช็ค").length
  };

  summaryBox.innerHTML = `
    <div class="row g-2 mb-3">
      <div class="col-6 col-md">
        <div class="student-item text-center">
          <b class="text-success">${count["มา"]}</b><br>มา
        </div>
      </div>

      <div class="col-6 col-md">
        <div class="student-item text-center">
          <b class="text-warning">${count["สาย"]}</b><br>สาย
        </div>
      </div>

      <div class="col-6 col-md">
        <div class="student-item text-center">
          <b class="text-danger">${count["ขาด"]}</b><br>ขาด
        </div>
      </div>

      <div class="col-6 col-md">
        <div class="student-item text-center">
          <b class="text-secondary">${count["ลา"]}</b><br>ลา
        </div>
      </div>
    </div>
  `;

  let html = `
    <div id="reportPrintArea" class="table-responsive bg-white p-3 rounded-4">
      <h5 class="text-center mb-1">รายงานการเช็คชื่อ</h5>
      <div class="text-center mb-3">
        วันที่ ${escapeHtml(value("reportDate"))}
        ห้องเรียน ${escapeHtml(getClassName(value("reportClass")))}
      </div>

      <table class="table table-bordered align-middle">
        <thead class="table-light">
          <tr class="text-center">
            <th>เลขที่</th>
            <th>เลขประจำตัว</th>
            <th>ชื่อ-สกุล</th>
            <th>สถานะ</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
  `;

  reportData.forEach(r => {
    html += `
      <tr>
        <td class="text-center">${escapeHtml(r.no)}</td>
        <td class="text-center">${escapeHtml(r.studentId)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td class="text-center">${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.note)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  tableBox.innerHTML = html;
}

function exportReportExcel() {
  if (reportData.length === 0) {
    Swal.fire("แจ้งเตือน", "กรุณาแสดงรายงานก่อน", "warning");
    return;
  }

  const rows = reportData.map(r => ({
    "เลขที่": r.no,
    "เลขประจำตัว": r.studentId,
    "ชื่อ-สกุล": r.name,
    "สถานะ": r.status,
    "หมายเหตุ": r.note
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  const fileName =
    `รายงานเช็คชื่อ_${getClassName(value("reportClass"))}_${value("reportDate")}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

async function exportReportPDF() {
  if (reportData.length === 0) {
    Swal.fire("แจ้งเตือน", "กรุณาแสดงรายงานก่อน", "warning");
    return;
  }

  const area = document.getElementById("reportPrintArea");
  if (!area) return;

  showLoading("กำลังสร้าง PDF...");

  try {
    const canvas = await html2canvas(area, {
      scale: 2,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = canvas.height * imgWidth / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fileName =
      `รายงานเช็คชื่อ_${getClassName(value("reportClass"))}_${value("reportDate")}.pdf`;

    pdf.save(fileName);

  } catch (err) {
    Swal.fire("ผิดพลาด", "สร้าง PDF ไม่สำเร็จ", "error");

  } finally {
    hideLoading();
  }
}