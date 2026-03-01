import { authClient } from "./app/lib/auth-client";
const res = await authClient.updateUser({ image: "/api/profile-image/test" });
console.log(res);
