const MAX_VERIFICATION_AGE_DAYS = 180;
const MAX_RUNTIME_CHECK_AGE_DAYS = 30;

export function assessResourceVerification(resource, {
  now = Date.now(),
  maxAgeDays = MAX_VERIFICATION_AGE_DAYS,
  runtimeCheck = null,
} = {}) {
  if (runtimeCheck) {
    const checkedAt = Date.parse(String(runtimeCheck.checked_at || "").replace(" ", "T") + (String(runtimeCheck.checked_at || "").includes("Z") ? "" : "Z"));
    const ageDays = Number.isFinite(checkedAt) ? Math.floor((now - checkedAt) / 86400000) : Infinity;
    if (ageDays <= MAX_RUNTIME_CHECK_AGE_DAYS) {
      return runtimeCheck.ok
        ? { verified: true, status: "runtime-fresh", ageDays, reason: "最近一次运行时链接核验成功。" }
        : { verified: false, status: "runtime-failed", ageDays, reason: runtimeCheck.reason || "最近一次运行时链接核验失败。" };
    }
    return { verified: false, status: "runtime-stale", reason: `最近一次链接核验已超过 ${MAX_RUNTIME_CHECK_AGE_DAYS} 天，需要重新核验。` };
  }
  if (resource?.verified !== true) {
    return { verified: false, status: "unverified", reason: "资源尚未经过目录验证。" };
  }
  const verifiedAt = Date.parse(`${resource.verifiedAt || ""}T00:00:00Z`);
  if (!Number.isFinite(verifiedAt)) {
    return { verified: false, status: "missing-date", reason: "资源缺少可审计的验证日期。" };
  }
  const ageDays = Math.floor((now - verifiedAt) / 86400000);
  if (ageDays < 0) {
    return { verified: false, status: "future-date", reason: "资源验证日期晚于当前诊断时间。" };
  }
  if (ageDays > maxAgeDays) {
    return { verified: false, status: "stale", reason: `资源最近验证已超过 ${maxAgeDays} 天，需要重新核验。` };
  }
  return { verified: true, status: "fresh", ageDays, reason: "资源目录验证仍在有效期内。" };
}

export function resourceVerificationMaxAgeDays() {
  return MAX_VERIFICATION_AGE_DAYS;
}

export async function verifyResourceUrl(url, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (!/^https:\/\//i.test(String(url || ""))) {
    return { ok: false, status: null, finalUrl: null, reason: "只允许核验 HTTPS 资源链接。" };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, status: null, finalUrl: null, reason: "当前运行环境没有可用的 fetch。" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetchImpl(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 403 || response.status === 405) {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: controller.signal,
      });
    }
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
      reason: response.ok ? "链接可访问。" : `服务器返回 HTTP ${response.status}。`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      finalUrl: null,
      reason: error?.name === "AbortError" ? `核验超过 ${timeoutMs}ms。` : `链接核验失败：${error?.message || "未知错误"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
