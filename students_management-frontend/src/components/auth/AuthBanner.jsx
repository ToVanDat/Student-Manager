import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const banners = [
    {
        image: '/login-campus.jpg',
        badge: 'STUDENT MANAGEMENT SYSTEM',
        title: 'Student Management',
        description: 'Hệ thống quản lý thông tin sinh viên và dữ liệu đào tạo của nhà trường.',
    },
    {
        image: '/login-classroom.jpg',
        badge: 'ACADEMIC MANAGEMENT',
        title: 'Quản lý đào tạo',
        description: 'Quản lý lớp học, môn học, học kỳ và thông tin đào tạo một cách tập trung.',
    },
    {
        image: '/login-library.jpg',
        badge: 'STUDENT SERVICES',
        title: 'Kết nối sinh viên',
        description: 'Tổ chức và quản lý dữ liệu sinh viên nhanh chóng, chính xác và hiệu quả.',
    },
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
            className="login-banner"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; touchEndX.current = null; }}
            onTouchMove={(event) => { touchEndX.current = event.touches[0].clientX; }}
            onTouchEnd={handleTouchEnd}
        >
            <div key={currentIndex} className="login-banner-slide active" style={{ backgroundImage: `url("${banner.image}")` }} />
            <div className="login-banner-overlay" />
            <div className="login-banner-content">
                <div className="banner-badge">{banner.badge}</div>
                <h2>{banner.title}</h2>
                <p>{banner.description}</p>
                <div className="banner-line" />
                <div className="banner-info">
                    <div className="banner-info-item"><strong>01</strong><span>Quản lý sinh viên</span></div>
                    <div className="banner-info-item"><strong>02</strong><span>Quản lý lớp học</span></div>
                    <div className="banner-info-item"><strong>03</strong><span>Quản lý đào tạo</span></div>
                </div>
            </div>
            <button type="button" className="banner-arrow banner-arrow-left" onClick={goPrevious} aria-label="Banner trước"><ChevronLeft size={24} /></button>
            <button type="button" className="banner-arrow banner-arrow-right" onClick={goNext} aria-label="Banner tiếp theo"><ChevronRight size={24} /></button>
            <div className="login-banner-indicators">
                {banners.map((item, index) => (
                    <button key={item.image} type="button" className={index === currentIndex ? 'active' : ''} onClick={() => setCurrentIndex(index)} aria-label={`Chuyển đến banner ${index + 1}`} />
                ))}
            </div>
            <div className="banner-swipe-hint">← Kéo để chuyển →</div>
        </div>
    );
}

export default AuthBanner;