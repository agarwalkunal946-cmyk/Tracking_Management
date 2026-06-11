import { toast } from "sonner";

function show(type, message) {
  toast.dismiss();
  return toast[type](message, { duration: type === "error" ? 4000 : 2800 });
}

export const notify = {
  success(message) {
    return show("success", message);
  },
  error(message) {
    return show("error", message);
  }
};
