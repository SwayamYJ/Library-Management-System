import React from 'react';
import { Info, AlertTriangle, AlertCircle } from 'lucide-react';

const NotificationBar = ({ issues }) => {
    if (!issues || issues.length === 0) return null;

    // Find the most urgent issue
    let worstCase = 1; // 1 = Safe (> 2 days), 2 = Warning (<= 2 days), 3 = Overdue (< 0 days)
    let minDays = Infinity;
    let totalFine = 0;

    issues.forEach(issue => {
        if (!issue.dueDate) return;
        const now = new Date();
        const due = new Date(issue.dueDate);

        // Let's reset time part for accurate day calculation
        now.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        const diffTime = due - now;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < minDays) {
            minDays = daysRemaining;
        }

        if (daysRemaining < 0) {
            totalFine += Math.abs(daysRemaining) * 10;
        }
    });

    if (minDays === Infinity) return null;

    if (minDays < 0) {
        worstCase = 3;
    } else if (minDays <= 2) {
        worstCase = 2;
    }

    if (worstCase === 1) {
        return (
            <div className="bg-sky-50 border border-sky-200 text-sky-800 px-4 py-3 rounded-xl mb-6 flex items-start space-x-3 shadow-sm">
                <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-sky-900">Enjoy your reading!</h4>
                    <p className="text-sm mt-0.5">You have {minDays} {minDays === 1 ? 'day' : 'days'} remaining for your earliest return.</p>
                </div>
            </div>
        );
    }

    if (worstCase === 2) {
        return (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6 flex items-start space-x-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-amber-900">Return soon!</h4>
                    <p className="text-sm mt-0.5">Only {minDays} {minDays === 1 ? 'day' : 'days'} left to avoid a fine on your upcoming due book.</p>
                </div>
            </div>
        );
    }

    if (worstCase === 3) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-start space-x-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-red-900">Overdue!</h4>
                    <p className="text-sm mt-0.5">A penalty of ₹{totalFine} has been applied to your account. Please return the overdue books immediately.</p>
                </div>
            </div>
        );
    }

    return null;
};

export default NotificationBar;
