import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Join Den · Create your account" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
