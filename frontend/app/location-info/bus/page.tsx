"use client";
import React from "react";
const BlogSinglePage = () => {
    return (
        <div className="w-96 h-[892px] relative bg-neutral-50 overflow-hidden">
            <div className="w-96 h-[802px] p-5 left-0 top-0 absolute inline-flex flex-col justify-start items-start gap-4">
                {/* Header */}
                <div className="self-stretch h-10 inline-flex flex-col justify-start items-start">
                    <div className="w-6 h-6 relative overflow-hidden">
                        <div className="w-4 h-3 left-[4px] top-[6px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                    </div>
                    <div className="self-stretch self-stretch inline-flex flex-col justify-between items-center">
                        <div className="justify-center text-gray-800 text-base font-semibold font-['Inter'] leading-5">Lancaster Bus Station</div>
                        <div className="w-30 h-4 justify-center text-stone-600 text-xs font-semibold font-['Inter'] leading-4">Last updated 14:32</div>
                    </div>
                </div>
                {/* Departures/Arrivals */}
                <div className="flex w-full gap-5 justify-center items-start self-stretch h-2 rounded-[10px] inline-flex flex-row justify-start items-start">
                        <div className="flex-1 p-4 self-stretch self-stretch bg-green-800 rounded-[10px] inline-flex justify-center items-center gap-1.5 overflow-hidden">
                            <div className="flex justify-center items-center gap-1.5">
                                <div className="text-center justify-start text-white text-base font-medium font-['Inter'] uppercase">Arrivals</div>
                            </div>
                        </div>
                        <div className="flex-1 p-4 self-stretch self-stretch bg-white rounded-[10px] outline outline-2 outline-offset-[-2px] outline-neutral-300 inline-flex justify-center items-center">
                            <div className="text-center justify-start text-zinc-700 text-base font-medium font-['Inter'] uppercase">Departures</div>
                        </div>
                    </div>

                <div className="h-[710px] flex flex-col justify-start items-center gap-2.5">
                    <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                        <div className="self-stretch inline-flex justify-between items-start">
                            <div className="inline-flex flex-col justify-start items-start gap-3">
                                <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">40 Preston<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Stand 1 </span></div>
                            </div>
                            <div className="flex justify-center items-start gap-2">
                                <div className="w-4 h-4 relative overflow-hidden">
                                    <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                </div>
                                <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">5 mins</div>
                            </div>
                            <div className="w-28 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
                            </div>
                        </div>
                    </div>
                    <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                        <div className="self-stretch inline-flex justify-between items-start">
                            <div className="w-16 inline-flex flex-col justify-start items-start gap-3">
                                <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">41 Morecambe<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Stand 4</span></div>
                            </div>
                            <div className="flex justify-center items-start gap-2">
                                <div className="w-4 h-4 relative overflow-hidden">
                                    <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                </div>
                                <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">12 mins</div>
                            </div>
                            <div className="w-28 px-2 py-1 bg-amber-100 rounded-md flex justify-center items-center gap-2.5">
                                <div className="justify-center text-yellow-600 text-xs font-medium font-['Inter'] leading-4">Delayed</div>
                            </div>
                        </div>
                    </div>

                    <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                        <div className="self-stretch inline-flex justify-between items-start">
                            <div className="w-16 inline-flex flex-col justify-start items-start gap-3">
                                <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">100 Underpass<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 6</span></div>
                            </div>
                            <div className="flex justify-center items-start gap-2">
                                <div className="w-4 h-4 relative overflow-hidden">
                                    <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                </div>
                                <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">18mins</div>
                            </div>
                            <div className="w-28 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
                            </div>
                        </div>
                    </div>

                    <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                        <div className="self-stretch inline-flex justify-between items-start">
                            <div className="w-16 inline-flex flex-col justify-start items-start gap-3">
                                <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">2X Kendal<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Stand 8</span></div>
                            </div>
                            <div className="bg-white flex justify-start items-start gap-3">
                                <div className="w-28 px-2 py-1 bg-rose-200 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-rose-500 text-xs font-medium font-['Inter'] leading-4">Scheduled only</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-96 h-20 p-2.5 left-0 top-[812px] absolute bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] inline-flex flex-col justify-center items-center gap-2.5">
                <div className="self-stretch h-12 px-5 py-2.5 bg-gradient-to-br from-green-800 to-green-800 rounded-[10px] inline-flex justify-center items-center gap-2.5">
                    <div className="text-center justify-start text-white text-lg font-bold font-['Source_Sans_Pro'] leading-4">View in Real Time</div>
                </div>
            </div>
        </div>
    );
};
export default BlogSinglePage;