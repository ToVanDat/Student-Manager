function StudentClassStatistics({ classStatistics }) {
    const maxCount = Math.max(0, ...classStatistics.map((item) => item.count));

    return (
        <div className="panel class-panel">
            <div className="panel-header compact">
                <div><h2>Sinh viên theo lớp</h2></div>
                <button className="text-button">Xem chi tiết</button>
            </div>
            <div className="class-chart">
                {classStatistics.length === 0 ? (
                    <div className="empty-chart">Chưa có dữ liệu lớp</div>
                ) : classStatistics.slice(0, 5).map((item) => (
                    <div className="class-row" key={item.code}>
                        <div className="class-row-info"><span>{item.code}</span><strong>{item.count}</strong></div>
                        <div className="class-progress">
                            <span style={{ width: `${maxCount ? (item.count / maxCount) * 100 : 0}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default StudentClassStatistics;