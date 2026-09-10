import axios from "@/app/frontend/utils/axios";
import { create } from "zustand";

export const useRestPassword = create((set) => ({
    loading: false,
    message: "",
    isNext: false,

    resetPassword: async (password, token) => {
        set({ loading: true });
        try {
            axios.post("/auth/reset-password", { password, token })
                .then(res => {
                    set({ loading: false, message: res.data.message, isNext: res.data.isNext });
                });

        } catch (error) {
            set({ loading: false });
            console.log(error);
        }
    }

}));