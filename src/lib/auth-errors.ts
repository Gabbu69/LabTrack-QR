type ProviderError = { code?: string; status?: number; message?: string };

export function signInErrorMessage(error: ProviderError) {
  if (error.code === "email_not_confirmed") return "Confirm your email using the link in your inbox, then sign in again.";
  if (error.status === 429 || error.code?.startsWith("over_")) return "Too many sign-in requests. Wait a few minutes before trying again.";
  if (error.status && error.status >= 500) return "Sign-in is temporarily unavailable. Please try again later.";
  return "Email or password is incorrect. If registration failed, complete registration first. Ask the custodian if you need a password reset.";
}

export function registrationErrorMessage(error: ProviderError) {
  if (["email_exists", "user_already_exists"].includes(error.code ?? "") || /already.*registered/i.test(error.message ?? "")) return "An account already uses this email. Sign in with that account, or ask the custodian to reset its password.";
  if (error.status === 429 || error.code?.startsWith("over_")) return "Too many registration requests. Wait a few minutes before trying again. Your details are kept below.";
  if (error.code === "weak_password") return "Choose a stronger password with at least eight characters.";
  if (["email_address_invalid", "validation_failed"].includes(error.code ?? "")) return "Check your email address and registration details, then try again.";
  if (error.code === "email_address_not_authorized") return "The verification email could not be delivered. Contact the laboratory custodian before registering again.";
  return "Registration is temporarily unavailable. Your details are kept below. Try again later, or ask the custodian to check your Student ID.";
}
