import React from 'react';
import OwnerReviewQueue from '../../components/owner/OwnerReviewQueue';

export default function OwnerReviewPage() {
  return (
    <div className="mx-auto max-w-4xl py-6 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-black dark:text-black mb-6 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Review queue</h1>
      <OwnerReviewQueue />
    </div>
  );
}
