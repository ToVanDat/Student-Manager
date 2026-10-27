import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

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
    const { t } = useLanguage();
    const bannerRef = useRef(null);
    const parallaxTarget = useRef({ x: 0, y: 0 });
    const parallaxCurrent = useRef({
        background: { x: 0, y: 0 },
        glow: { x: 0, y: 0 },
        grid: { x: 0, y: 0 },
    });
    const parallaxFrame = useRef(null);

    // Smooth, frame-synced motion with a different response weight per layer.
    // Only decorative transforms move; copy, controls and the login card stay still.
    const animateParallax = () => {
        const element = bannerRef.current;
        if (!element) {
            parallaxFrame.current = null;
            return;
        }

        const target = parallaxTarget.current;
        const current = parallaxCurrent.current;
        const layers = [
            { key: 'background', factor: -0.16, easing: 0.055, x: '--parallax-back-x', y: '--parallax-back-y' },
            { key: 'glow', factor: 0.34, easing: 0.085, x: '--parallax-glow-x', y: '--parallax-glow-y' },
            { key: 'grid', factor: -0.48, easing: 0.045, x: '--parallax-grid-x', y: '--parallax-grid-y' },
        ];

        let moving = false;
        layers.forEach(({ key, factor, easing, x, y }) => {
            const layer = current[key];
            const nextX = target.x * factor;
            const nextY = target.y * factor;
            layer.x += (nextX - layer.x) * easing;
            layer.y += (nextY - layer.y) * easing;
            if (Math.abs(nextX - layer.x) > 0.015 || Math.abs(nextY - layer.y) > 0.015) moving = true;
            element.style.setProperty(x, `${layer.x.toFixed(3)}px`);
            element.style.setProperty(y, `${layer.y.toFixed(3)}px`);
        });

        if (moving) {
            parallaxFrame.current = window.requestAnimationFrame(animateParallax);
        } else {
            parallaxFrame.current = null;
        }
    };

    const handlePointerMove = (event) => {
        const element = bannerRef.current;
        if (!element || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        parallaxTarget.current = {
            x: Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width - 0.5)) * 18,
            y: Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height - 0.5)) * 18,
        };
        if (parallaxFrame.current === null) {
            parallaxFrame.current = window.requestAnimationFrame(animateParallax);
        }
    };

    const resetParallax = () => {
        parallaxTarget.current = { x: 0, y: 0 };
        if (parallaxFrame.current === null && bannerRef.current) {
            parallaxFrame.current = window.requestAnimationFrame(animateParallax);
        }
    };

    useEffect(() => () => {
        if (parallaxFrame.current !== null) window.cancelAnimationFrame(parallaxFrame.current);
    }, []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const localizedBanners = [
        { id: 'campus', badge: t('authBannerCampusBadge'), title: t('authBannerCampusTitle'), description: t('authBannerCampusDescription') },
        { id: 'academic', badge: t('authBannerAcademicBadge'), title: t('authBannerAcademicTitle'), description: t('authBannerAcademicDescription') },
        { id: 'community', badge: t('authBannerCommunityBadge'), title: t('authBannerCommunityTitle'), description: t('authBannerCommunityDescription') },
    ];
    const banner = localizedBanners[currentIndex];

    useEffect(() => {
        if (isCarouselPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const timer = window.setInterval(() => {
            setCurrentIndex((current) => (current + 1) % banners.length);
        }, 6800);
        return () => window.clearInterval(timer);
    }, [isCarouselPaused]);

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
            ref={bannerRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetParallax}
            onPointerCancel={resetParallax}
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onFocusCapture={() => setIsCarouselPaused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsCarouselPaused(false);
            }}
            className="relative min-h-[42vh] select-none overflow-hidden bg-slate-950 [touch-action:pan-y] min-[801px]:min-h-screen motion-reduce:transform-none"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; touchEndX.current = null; }}
            onTouchMove={(event) => { touchEndX.current = event.touches[0].clientX; }}
            onTouchEnd={handleTouchEnd}
        >
            <style>{`
                @keyframes authBannerAtmosphereIn {
                    from { opacity: 0.35; }
                    to { opacity: 1; }
                }
                @keyframes authBannerCopyIn {
                    from { opacity: 0; transform: translate3d(0, 9px, 0); }
                    to { opacity: 1; transform: translate3d(0, 0, 0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .auth-banner-atmosphere, .auth-banner-copy { animation: none !important; }
                }
            `}</style>
            <div
                key={currentIndex}
                className={`auth-banner-atmosphere absolute -inset-8 z-[1] h-[calc(100%+4rem)] w-[calc(100%+4rem)] bg-linear-to-br ${bannerBackgrounds[currentIndex]} will-change-[opacity,transform]`}
                style={{ animation: 'authBannerAtmosphereIn 1100ms cubic-bezier(0.22, 1, 0.36, 1) both', transform: 'translate3d(var(--parallax-back-x, 0px), var(--parallax-back-y, 0px), 0) scale(1.015)' }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -inset-12 z-[2] opacity-65 will-change-transform motion-reduce:transform-none"
                style={{
                    transform: 'translate3d(var(--parallax-glow-x, 0px), var(--parallax-glow-y, 0px), 0)',
                    background: 'radial-gradient(ellipse at 18% 24%, rgba(94, 234, 212, 0.18), transparent 34%), radial-gradient(ellipse at 78% 72%, rgba(96, 165, 250, 0.17), transparent 38%), radial-gradient(ellipse at 52% 48%, rgba(255,255,255,0.045), transparent 56%)'
                }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -inset-6 z-[2] opacity-20 will-change-transform motion-reduce:transform-none"
                style={{
                    transform: 'translate3d(var(--parallax-grid-x, 0px), var(--parallax-grid-y, 0px), 0)',
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0)',
                    backgroundSize: '34px 34px',
                    maskImage: 'linear-gradient(135deg, black, transparent 78%)'
                }}
                aria-hidden="true"
            />
            <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:64px_64px] opacity-30" />
            <div className="pointer-events-none absolute inset-0 z-[2] bg-linear-to-r from-slate-950/35 via-slate-950/10 to-transparent" />
            <div key={currentIndex} className="auth-banner-copy absolute bottom-[15%] left-12 right-12 z-[3] max-w-[700px] text-white min-[801px]:bottom-[13%] min-[801px]:left-[8%] min-[801px]:right-[10%]" style={{ animation: 'authBannerCopyIn 620ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
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
                    <div className="flex flex-col gap-1"><strong className="text-xs leading-none font-extrabold text-white min-[451px]:text-sm min-[601px]:text-xl">01</strong><span className="text-[7px] leading-[1.4] text-white/70 min-[451px]:text-[8px] min-[601px]:text-[11px]">{t("authFeatureStudents")}</span></div>
                    <div className="flex flex-col gap-1"><strong className="text-xs leading-none font-extrabold text-white min-[451px]:text-sm min-[601px]:text-xl">02</strong><span className="text-[7px] leading-[1.4] text-white/70 min-[451px]:text-[8px] min-[601px]:text-[11px]">{t("authFeatureClasses")}</span></div>
                    <div className="flex flex-col gap-1"><strong className="text-xs leading-none font-extrabold text-white min-[451px]:text-sm min-[601px]:text-xl">03</strong><span className="text-[7px] leading-[1.4] text-white/70 min-[451px]:text-[8px] min-[601px]:text-[11px]">{t("authFeatureAcademics")}</span></div>
                </div>
            </div>
            <button type="button" className="absolute left-2.5 top-1/2 z-[5] flex size-[34px] -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/30 text-white opacity-100 backdrop-blur transition hover:scale-105 hover:bg-white/15 min-[451px]:left-[15px] min-[451px]:size-[38px] min-[801px]:left-[25px] min-[801px]:size-[46px] min-[801px]:opacity-0 min-[801px]:hover:opacity-100" onClick={goPrevious} aria-label={t("previousBanner")}><ChevronLeft size={24} /></button>
            <button type="button" className="absolute right-2.5 top-1/2 z-[5] flex size-[34px] -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/30 text-white opacity-100 backdrop-blur transition hover:scale-105 hover:bg-white/15 min-[451px]:right-[15px] min-[451px]:size-[38px] min-[451px]:size-[38px] min-[801px]:right-[25px] min-[801px]:size-[46px] min-[801px]:opacity-0 min-[801px]:hover:opacity-100" onClick={goNext} aria-label={t("nextBanner")}><ChevronRight size={24} /></button>
            <div className="absolute bottom-[13px] left-1/2 z-[6] flex -translate-x-1/2 items-center gap-2 min-[601px]:bottom-8">
                {banners.map((item, index) => (
                    <button key={item.id} type="button" className={`h-[3px] rounded-full bg-white/35 transition-all hover:bg-white/70 min-[601px]:h-1 ${index === currentIndex ? 'w-[34px] bg-white min-[601px]:w-12' : 'w-[18px] min-[601px]:w-6'}`} onClick={() => setCurrentIndex(index)} aria-label={t("goToBanner", { number: index + 1 })} />
                ))}
            </div>
            <div className="pointer-events-none absolute right-7 bottom-7 z-[5] hidden text-[10px] text-white/45 min-[801px]:block">{t("swipeToChange")}</div>
        </div>
    );
}

export default AuthBanner;