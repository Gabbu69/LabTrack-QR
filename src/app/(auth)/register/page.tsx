import { redirect } from "next/navigation";

export default function RegisterPage() {
  redirect("/login?message=Accounts%20are%20created%20by%20the%20tool%20custodian.%20Ask%20your%20custodian%20for%20your%20sign-in%20details.");
}
