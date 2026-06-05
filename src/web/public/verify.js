"use strict";

const state = {
  csrfToken: "",
  expiresAt: 0,
  timer: null,
  countries: []
};

const els = {
  closedView: document.getElementById("closed-view"),
  discordView: document.getElementById("discord-view"),
  phoneView: document.getElementById("phone-view"),
  progressDiscord: document.getElementById("progress-discord"),
  progressPhone: document.getElementById("progress-phone"),
  progressLine: document.getElementById("progress-line"),
  oauthMessage: document.getElementById("oauth-message"),
  welcome: document.getElementById("welcome-label"),
  country: document.getElementById("country"),
  phone: document.getElementById("phone"),
  phoneControl: document.getElementById("phone-control"),
  sendOtp: document.getElementById("send-otp"),
  sendMessage: document.getElementById("send-message"),
  otpSection: document.getElementById("otp-section"),
  otpInputs: Array.from(document.querySelectorAll(".otp-digit")),
  otpInputsWrap: document.getElementById("otp-inputs"),
  verifyOtp: document.getElementById("verify-otp"),
  verifyMessage: document.getElementById("verify-message"),
  ring: document.getElementById("ring-progress"),
  ringTime: document.getElementById("ring-time"),
  countdownText: document.getElementById("countdown-text"),
  countdownRing: document.querySelector(".countdown-ring"),
  resendOtp: document.getElementById("resend-otp"),
  successOverlay: document.getElementById("success-overlay"),
  confetti: document.getElementById("confetti")
};

function safeText(value) {
  return String(value || "").replace(/[<>&"'`;=(){}[\]\\\/]/g, "").slice(0, 100);
}

function setMessage(element, text, type) {
  element.className = "message" + (type ? " " + type : "");
  element.textContent = text;
}

function setLoading(button, loading) {
  button.classList.toggle("loading", loading);
  button.disabled = loading;
}

function showView(name, payload) {
  els.closedView.classList.toggle("active", name === "closed");
  els.discordView.classList.toggle("active", name === "discord");
  els.phoneView.classList.toggle("active", name === "phone");
  els.progressDiscord.className = "progress-step " + (name === "discord" ? "active" : "done");
  els.progressPhone.className = "progress-step " + (name === "phone" ? "active" : name === "done" ? "done" : "");
  els.progressLine.className = "progress-line " + (name === "phone" || name === "done" ? "done" : "");
  if (name === "phone") {
    const displayName = safeText(payload && (payload.displayName || payload.username));
    els.welcome.textContent = "مرحباً " + displayName;
  }
}

async function api(path, options) {
  const request = options || {};
  const headers = Object.assign({}, request.headers || {});
  if (request.method === "POST") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = state.csrfToken;
  }
  const response = await fetch(path, Object.assign({ credentials: "include", headers }, request));
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    const error = new Error(data.message || "حدث خطأ، حاول مرة أخرى.");
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadCountries() {
  const response = await fetch("/api/countries", { credentials: "include" });
  if (!response.ok) throw new Error("تعذر تحميل قائمة الدول.");
  const data = await response.json();
  const displayNames = new Intl.DisplayNames(["ar"], { type: "region" });
  state.countries = (data.countries || []).map((country) => ({
    ...country,
    name: displayNames.of(country.code) || country.code
  })).sort((a, b) => {
    if (a.code === "SA") return -1;
    if (b.code === "SA") return 1;
    return a.name.localeCompare(b.name, "ar");
  });

  const fragment = document.createDocumentFragment();
  for (const country of state.countries) {
    const option = document.createElement("option");
    option.value = country.code;
    option.textContent = country.name + " (" + country.callingCode + ")";
    fragment.appendChild(option);
  }
  els.country.replaceChildren(fragment);
  els.country.value = localStorage.getItem("phoneCountry") || "SA";
  if (!els.country.value) els.country.value = "SA";
}

function phonePayload() {
  return {
    countryCode: els.country.value,
    nationalNumber: els.phone.value.replace(/\D/g, "")
  };
}

function validatePhoneField() {
  const length = phonePayload().nationalNumber.length;
  els.phoneControl.classList.toggle("valid", length >= 7 && length <= 15);
  els.phoneControl.classList.toggle("invalid", length > 0 && (length < 7 || length > 15));
  return length >= 7 && length <= 15;
}

function otpValue() {
  return els.otpInputs.map((input) => input.value).join("");
}

function updateOtpButton() {
  els.verifyOtp.disabled = !/^\d{6}$/.test(otpValue());
}

function fillOtp(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 6);
  digits.split("").forEach((digit, index) => {
    els.otpInputs[index].value = digit;
  });
  if (digits.length < 6) els.otpInputs[digits.length].focus();
  else els.otpInputs[5].focus();
  updateOtpButton();
}

function updateCountdown() {
  const total = 600;
  const remaining = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const label = minutes + ":" + seconds;
  const progress = Math.max(0, remaining / total);
  els.ring.setAttribute("stroke-dashoffset", String(119.38 * (1 - progress)));
  els.ringTime.textContent = label;
  els.countdownText.textContent = remaining > 0 ? "ينتهي الرمز خلال " + label : "انتهت صلاحية الرمز";
  els.countdownRing.classList.toggle("warning", remaining > 0 && remaining <= 300);
  els.countdownRing.classList.toggle("danger", remaining <= 60);
  els.resendOtp.disabled = remaining > 0;
  els.sendOtp.disabled = remaining > 0;
  els.resendOtp.textContent = remaining > 0 ? "إعادة الإرسال خلال " + label : "إعادة إرسال الرمز";
  if (remaining === 0 && state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function startCountdown(seconds) {
  if (state.timer) clearInterval(state.timer);
  state.expiresAt = Date.now() + seconds * 1000;
  updateCountdown();
  state.timer = setInterval(updateCountdown, 1000);
}

function showSuccess() {
  els.successOverlay.classList.add("active");
  els.successOverlay.setAttribute("aria-hidden", "false");
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 30; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece confetti-" + (index + 1);
    fragment.appendChild(piece);
  }
  els.confetti.replaceChildren(fragment);
}

async function loadStatus() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("closed") === "1") {
    showView("closed", {});
    return;
  }
  if (params.get("oauthError") === "1") {
    showView("discord", {});
    setMessage(
      els.oauthMessage,
      "تعذر إكمال ربط Discord. افتح الربط من جديد ووافق على الصلاحيات المطلوبة.",
      "error"
    );
    window.history.replaceState({}, document.title, "/verify");
    return;
  }
  const status = await api("/api/status", { method: "GET" });
  if (status.step === "discord") {
    showView("discord", status);
    return;
  }
  if (status.step === "done") {
    showView("done", status);
    showSuccess();
    return;
  }
  const csrf = await api("/api/csrf-token", { method: "GET" });
  state.csrfToken = csrf.csrfToken;
  showView("phone", status);
}

async function sendOtp(button) {
  setMessage(els.sendMessage, "", "");
  if (!validatePhoneField()) {
    setMessage(els.sendMessage, "اختر الدولة واكتب رقم الواتساب الصحيح بدون مفتاح الدولة.", "error");
    return;
  }
  try {
    setLoading(button, true);
    const data = await api("/api/send-otp", {
      method: "POST",
      body: JSON.stringify(phonePayload())
    });
    setMessage(els.sendMessage, "تم إرسال رمز التحقق إلى " + data.phone + ".", "success");
    els.otpSection.classList.add("active");
    els.otpInputs[0].focus();
    startCountdown(Number(data.resendAfter || 600));
  } catch (error) {
    if (error.data && error.data.code === "OTP_COOLDOWN") {
      els.otpSection.classList.add("active");
      startCountdown(Number(error.data.retryAfter || 600));
      setMessage(els.sendMessage, error.message, "error");
    } else {
      setMessage(els.sendMessage, error.message || "تعذر إرسال الرمز.", "error");
    }
  } finally {
    setLoading(button, false);
    if (state.expiresAt > Date.now()) {
      els.sendOtp.disabled = true;
      els.resendOtp.disabled = true;
    }
  }
}

async function verifyOtp() {
  const otp = otpValue();
  setMessage(els.verifyMessage, "", "");
  if (!validatePhoneField() || !/^\d{6}$/.test(otp)) {
    setMessage(els.verifyMessage, "تأكد من الرقم ورمز التحقق.", "error");
    return;
  }
  try {
    setLoading(els.verifyOtp, true);
    await api("/api/verify-otp", {
      method: "POST",
      body: JSON.stringify({ ...phonePayload(), otp })
    });
    showSuccess();
  } catch (error) {
    els.otpInputsWrap.classList.remove("shake");
    void els.otpInputsWrap.offsetWidth;
    els.otpInputsWrap.classList.add("shake");
    setMessage(els.verifyMessage, error.message || "رمز غير صحيح.", "error");
  } finally {
    setLoading(els.verifyOtp, false);
    updateOtpButton();
  }
}

els.phone.addEventListener("input", () => {
  els.phone.value = els.phone.value.replace(/\D/g, "").slice(0, 15);
  validatePhoneField();
});
els.country.addEventListener("change", () => {
  localStorage.setItem("phoneCountry", els.country.value);
  validatePhoneField();
});
els.otpInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(-1);
    if (input.value && index < 5) els.otpInputs[index + 1].focus();
    updateOtpButton();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && index > 0) els.otpInputs[index - 1].focus();
    if (event.key === "ArrowLeft" && index > 0) els.otpInputs[index - 1].focus();
    if (event.key === "ArrowRight" && index < 5) els.otpInputs[index + 1].focus();
  });
});
els.otpInputsWrap.addEventListener("paste", (event) => {
  event.preventDefault();
  fillOtp(event.clipboardData.getData("text"));
});
els.sendOtp.addEventListener("click", () => sendOtp(els.sendOtp));
els.resendOtp.addEventListener("click", () => sendOtp(els.resendOtp));
els.verifyOtp.addEventListener("click", verifyOtp);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await Promise.all([loadCountries(), loadStatus()]);
  } catch (error) {
    setMessage(els.sendMessage, error.message || "تعذر تحميل صفحة التحقق.", "error");
  }
});
