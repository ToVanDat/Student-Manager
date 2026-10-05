import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const banners = [
    {
        id: 'campus',
        badge: 'STUDENT MANAGEMENT SYSTEM',
        title: 'Student Management',
        description: 'Hệ thống quản lý thông tin sinh viên và dữ liệu đào tạo của nhà trường.',
    },
    {
        id: 'academic',
        badge: 'ACADEMIC MANAGEMENT',
        title: 'Quản lý đào tạo',
        description: 'Quản lý lớp học, môn học, học kỳ và thông tin đào tạo một cách tập trung.',
    },
    {
        id: 'community',
        badge: 'STUDENT SERVICES',
        title: 'Kết nối sinh viên',
        description: 'Tổ chức và quản lý dữ liệu sinh viên nhanh chóng, chính xác và hiệu quả.',
    },
];

const bannerBackgrounds = [
    'from-[#10233f] via-[#174766] to-[#28707c]',
    'from-[#13243c] via-[#244d67] to-[#467d78]',
    'from-[#11253a] via-[#1b4960] to-[#326875]',
];

function AuthBanner() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const banner = banners[currentIndex];

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((current) => (current + 1) % banners.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const goNext = () => setCurrentIndex((current) => (current + 1) % banners.length);
    const goPrevious = () => setCurrentIndex((current) => (current - 1 + banners.length) % banners.length);

    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) return;
        const distance = touchStartX.current - touchEndX.current;
        if (Math.abs(distance) >= 50) {
            if (distance > 0) {
                goNext();
            } else {
                goPrevious();
            }
        }
        touchStartX.current = null;
        touchEndX.current = null;
    };

    return (
        <div
            className="relative min-h-[42vh] select-none overflow-hidden bg-slate-950 [touch-action:pan-y] min-[801px]:min-h-screen"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; touchEndX.current = null; }}
            onTouchMove={(event) => { touchEndX.current = event.touches[0].clientX; }}
            onTouchEnd={handleTouchEnd}
        >
            <div key={currentIndex} className={`absolute inset-0 z-[1] h-full w-full animate-banner-fade bg-linear-to-br ${bannerBackgrounds[currentIndex]}`} />
            <div className="absolute inset-0 z-[2] bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:52px_52px] opacity-35" />
            <div className="absolute inset-0 z-[2] bg-linear-to-r from-slate-950/35 via-slate-950/10 to-transparent" />
            <div className="absolute bottom-[15%] left-12 right-12 z-[3] max-w-[700px] text-white min-[801px]:bottom-[13%] min-[801px]:left-[8%] min-[801px]:right-[10%]">
                <div className="mb-3 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[9px] font-bold tracking-[1.2px] text-white/95 backdrop-blur-md min-[601px]:mb-5 min-[601px]:px-3.5 min-[601px]:py-2 min-[601px]:text-[11px]">
                    {banner.badge}
                </div>
                <h2 className="mb-2 text-[26px] leading-[1.05] font-extrabold text-white min-[451px]:text-[30px] min-[601px]:text-[34px] min-[801px]:mb-[18px] min-[801px]:text-[clamp(38px,4vw,64px)]">
                    {banner.title}
                </h2>
                <p className="max-w-[600px] text-[11px] leading-[1.5] text-white/80 min-[451px]:text-xs min-[601px]:text-[13px] min-[801px]:text-base min-[801px]:leading-[1.75]">
                    {banner.description}
                </p>
                <div className="my-4 h-0.5 w-[45px] rounded-full bg-white min-[601px]:my-7 min-[601px]:h-[3px] min-[601px]:w-[60px]" />
                <div className="flex items-center gap-3 min-[451px]:gap-4 min-[601px]:gap-8">
                    <div className="flex flex-col gap-1"><strong className="text-xs leading-none font-extrabold text-white min-[451px]:text-sm min-[601px]:text-xl">01</strong><span className="text-[7px] leading-[1.4] text-white/70 min-[451px]:text-[8px] min-[601px]:text-[11px]">Quản lý sinh viên</span></div>
                    <div className="flex flex-col gap-1"><strong className="text-xs leading-none font-extrabold text-white min-[451px]:text-sm min-[601px]:text-xl">02</strong><span className="text-[7px] leading-[1.4] text-white/70 min-[451px]:text-[8px] min-[601px]:text-[11px]">Quản lý lớp học</span></div>
                    <div className="flex flex-col gap-1"><strong className="text-xs leading-none font-extrabold text-white min-[451px]:text-sm min-[601px]:text-xl">03</strong><span className="text-[7px] leading-[1.4] text-white/70 min-[451px]:text-[8px] min-[601px]:text-[11px]">Quản lý đào tạo</span></div>
                </div>
            </div>
            <button type="button" className="absolute left-2.5 top-1/2 z-[5] flex size-[34px] -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/30 text-white opacity-100 backdrop-blur transition hover:scale-105 hover:bg-white/15 min-[451px]:left-[15px] min-[451px]:size-[38px] min-[801px]:left-[25px] min-[801px]:size-[46px] min-[801px]:opacity-0 min-[801px]:hover:opacity-100" onClick={goPrevious} aria-label="Banner trước"><ChevronLeft size={24} /></button>
            <button type="button" className="absolute right-2.5 top-1/2 z-[5] flex size-[34px] -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/30 text-white opacity-100 backdrop-blur transition hover:scale-105 hover:bg-white/15 min-[451px]:right-[15px] min-[451px]:size-[38px] min-[451px]:size-[38px] min-[801px]:right-[25px] min-[801px]:size-[46px] min-[801px]:opacity-0 min-[801px]:hover:opacity-100" onClick={goNext} aria-label="Banner tiếp theo"><ChevronRight size={24} /></button>
            <div className="absolute bottom-[13px] left-1/2 z-[6] flex -translate-x-1/2 items-center gap-2 min-[601px]:bottom-8">
                {banners.map((item, index) => (
                    <button key={item.id} type="button" className={`h-[3px] rounded-full bg-white/35 transition-all hover:bg-white/70 min-[601px]:h-1 ${index === currentIndex ? 'w-[34px] bg-white min-[601px]:w-12' : 'w-[18px] min-[601px]:w-6'}`} onClick={() => setCurrentIndex(index)} aria-label={`Chuyển đến banner ${index + 1}`} />
                ))}
            </div>
            <div className="pointer-events-none absolute right-7 bottom-7 z-[5] hidden text-[10px] text-white/45 min-[801px]:block">← Kéo để chuyển →</div>
        </div>
    );
}

export default AuthBanner;