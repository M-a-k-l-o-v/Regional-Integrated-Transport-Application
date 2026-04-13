"use client";
import React from "react";
const BlogSinglePage = () => {
    return (
        <div>
            <div className="w-96 h-[892px] relative bg-neutral-50 overflow-hidden">
                {/* Header */}
                <div className="w-96 h-[802px] p-5 left-0 top-0 absolute inline-flex flex-col justify-start items-start gap-4">
                    <div className="self-stretch h-10 inline-flex flex-col justify-start items-start">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-4 h-3 left-[4px] top-[6px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                        </div>
                        <div className="self-stretch self-stretch inline-flex flex-col justify-between items-center">
                            <div className="justify-center text-gray-800 text-base font-semibold font-['Inter'] leading-5"></div>
                            <div className="w-30 h-4 justify-center text-stone-600 text-xs font-semibold font-['Inter'] leading-4">Last updated 14:32</div>
                        </div>
                    </div>

                    {/* Arrivals and Departures Buttons */}
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
                    
                    {/* FlexBox for item 1 */}
                    <div className="h-[710px] flex flex-col justify-start items-center gap-2.5">
                        <div className="w-96 p-4 opacity-50 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-start items-start gap-3">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:00</div>
                                    </div>
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Blackburn</div>
                                </div>
                            </div>
                        </div>

                        {/* FlexBox for item 2 */}
                        <div className="w-96 p-4 opacity-50 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-start items-start gap-3">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:10</div>
                                    </div>
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Burnley</div>
                                </div>
                            </div>
                        </div>
                        <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:20</div>
                                    </div>
                                    <div className="justify-center">
                                        <span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Preston<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 3 • Nothern</span></div>
                                </div>
                                <div className="flex justify-start items-start gap-3">
                                    <div className="p-0.5 bg-blue-600 rounded-md flex justify-start items-start gap-2.5">
                                        <div className="w-5 h-5 relative overflow-hidden">
                                            <div className="w-[1.67px] h-[1.67px] left-[12.50px] top-[2.50px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                                            <div className="w-[5px] h-1.5 left-[10.83px] top-[10px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                                            <div className="w-2 h-1.5 left-[4.17px] top-[4.17px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                                            <div className="w-1.5 h-1.5 left-[3.35px] top-[12.08px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                                            <div className="w-1.5 h-1.5 left-[5.73px] top-[9.20px] absolute outline outline-2 outline-offset-[-1px] outline-white" />
                                        </div>
                                    </div>
                                    <div className="w-28 px-2 py-1 bg-indigo-50 rounded-md flex justify-center items-center gap-2.5">
                                        <div className="justify-center text-blue-600 text-xs font-medium font-['Inter'] leading-4">Current</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:35</div>
                                    </div>
                                    <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Barrow-in-Furness<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 2 • Nothern</span></div>
                                </div>
                                <div className="w-28 px-2 py-1 bg-amber-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-yellow-600 text-xs font-medium font-['Inter'] leading-4">Delayed</div>
                                </div>
                            </div>
                        </div>
                        <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:50</div>
                                    </div>
                                    <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Morecambe<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 2 • Nothern</span></div>
                                </div>
                                <div className="w-28 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
                                </div>
                            </div>
                        </div>
                        <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">18:05</div>
                                    </div>
                                    <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Blackpool<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform --- • Avanti West Coast</span></div>
                                </div>
                                <div className="bg-white flex justify-start items-start gap-3">
                                    <div className="w-28 px-2 py-1 bg-rose-200 rounded-md flex justify-center items-center gap-2.5">
                                        <div className="justify-center text-rose-500 text-xs font-medium font-['Inter'] leading-4">Scheduled only</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="w-96 p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Reeves Corner</div>
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <div className="w-3.5 h-3.5 left-[1.33px] top-[1.33px] absolute outline outline-[1.50px] outline-offset-[-0.75px] outline-zinc-600" />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">Next arrival : Today / 9:35</div>
                                    </div>
                                </div>
                                <div className="w-20 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
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
            {/* Additional content for the blog page */}
        </div>
    );
};
export default BlogSinglePage;