import { redirect } from "next/navigation";

// Projects are the only section so far; /admin lands there.
export default function AdminHome() {
  redirect("/admin/leads");
}
