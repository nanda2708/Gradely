import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const useGradeNavigation = (role) => {
    const navigate = useNavigate();
    return useCallback((submission) => navigate(`/checkSubmission/${submission.assignment}/${submission._id}`, {
        state: { returnPath: window.location.pathname, role }
    }), [navigate, role]);
};
