'use client';

import { useState } from 'react';
import clsx from 'clsx';

type UserFormData = {
    firstName: string;
    lastName: string;
    permission: string;
};

const initialFormData: UserFormData = {
    firstName: '',
    lastName: '',
    permission: '',
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
    onChange: any;
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


export default function AddPermissionPage() {
    const [formData, setFormData] = useState<UserFormData>(initialFormData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitted:', formData);
        // Permission added successfully
    };

    return (
        <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                Add Permission
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <FloatInput
                    type="text"
                    name="permission"
                    placeholder="Add Permission"
                    value={formData.permission}
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

