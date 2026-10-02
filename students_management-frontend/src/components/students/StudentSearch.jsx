import { ArrowUpDown, Filter, Search, X } from 'lucide-react';

function StudentSearch({ value, onChange }) {
    return (
        <div className="table-toolbar">
            <div className="table-search">
                <Search size={17} />
                <input
                    placeholder="Tìm theo mã, tên, email..."
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                {value && <button onClick={() => onChange('')}><X size={15} /></button>}
            </div>
            <button className="toolbar-button"><Filter size={16} />Bộ lọc</button>
            <button className="toolbar-button"><ArrowUpDown size={16} />Sắp xếp</button>
        </div>
    );
}

export default StudentSearch;