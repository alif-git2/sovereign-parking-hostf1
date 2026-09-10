import axios from "@/app/frontend/utils/axios";
import { create } from "zustand";

export const useCodeVerify = create((set) => ({
    loading: false,
    message: "",
    isNext: false,

    verifyCode: async (code) => {
        set({ loading: true });
        try {
            axios.post("/auth/verifyOtpCode", { code })
                .then(res => {
                    set({ loading: false, message: res.data.message, isNext: res.data.isNext });
                });

        } catch (error) {
             set({ loading: false });
            console.log(error);
        }
    }
}))