import axios from "@/app/frontend/utils/axios";
import { create } from "zustand";

export const useForget = create((set) => ({
    loading: false,
    message: "",
    isNext: false,
    token: null,

    forgetPassword: async (email) => {
        set({ loading: true });
        try {
            axios.post("/auth/verify-user", { email })
                .then(res => {
                    set({ loading: false, message: res.data?.message, isNext: res.data.isNext, token: res.data.token });
                });
        } catch (error) {
            console.log(error);
            set({ loading: false, message: error, isNext: false });
        }
    }

}));
