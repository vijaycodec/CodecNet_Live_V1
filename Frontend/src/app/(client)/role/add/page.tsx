'use client';

import { useState } from 'react';
import clsx from 'clsx';

type RoleFormData = {
    role: string;
    level: 'L1' | 'L2' | 'L3' | '';
    permissions: string;
};

const initialFormData: RoleFormData = {
    role: '',
    level: '',
    permissions: '',
};

const FloatInput = ({
    type,
    name,
    placeholder,
    value,
    onChange,
}: {
    type: string;
    name: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
    <div className="relative w-full">
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            required
            className={clsx(
                'peer w-full px-3 pt-5 pb-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            )}
            placeholder=" "
        />
        <span
            className={clsx(
                'absolute left-3 top-2 text-xs text-gray-500 dark:text-gray-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-500 dark:peer-focus:text-blue-400'
            )}
        >
            {placeholder}
        </span>
    </div>
);

export default function AddRolePage() {
    const [formData, setFormData] = useState<RoleFormData>(initialFormData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitted Role:', formData);
        alert('Role submitted successfully!');
        // Role added successfully
    };

    return (
        <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Add New Role</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <FloatInput
                    type="text"
                    name="role"
                    placeholder="Role Name"
                    value={formData.role}
                    onChange={handleChange}
                />

                <div className="relative w-full">
                    <select
                        name="level"
                        value={formData.level}
                        onChange={handleChange}
                        required
                        className="peer w-full px-3 pt-5 pb-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    >
                        <option value="" disabled hidden></option>
                        <option value="L1">L1</option>
                        <option value="L2">L2</option>
                        <option value="L3">L3</option>
                    </select>
                    <span className="absolute left-3 top-2 text-sm text-gray-500 dark:text-gray-400 transition-all duration-200 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-500 dark:peer-focus:text-blue-400">
                        Select Level
                    </span>
                </div>

                <FloatInput
                    type="text"
                    name="permissions"
                    placeholder="Permissions (comma separated)"
                    value={formData.permissions}
                    onChange={handleChange}
                />

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors font-semibold"
                >
                    Submit
                </button>
            </form>
        </div>
    );
}
