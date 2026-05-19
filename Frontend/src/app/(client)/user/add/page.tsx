'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

type Role = {
  _id: string;
  name: string;
};

type UserFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  client: string;
  role: string;
  level: 'L1' | 'L2' | 'L3' | '';
  isActive: 'Active' | 'Inactive' | '';
  password: string;
};

const initialFormData: UserFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  client: '',
  role: '',
  level: '',
  isActive: '',
  password: '',
};

const FloatInput = ({
  type,
  name,
  placeholder,
  value,
  onChange,
  pattern,
  title,
}: {
  type: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: any;
  pattern?: string;
  title?: string;
}) => (
  <div className="relative w-full">
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      pattern={pattern}
      title={title}
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

export default function AddUserPage() {
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [roles, setRoles] = useState<Role[]>([]); // ✅ 1. Add roles state
  const router = useRouter(); // ✅ Initialize router

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const token = Cookies.get('auth_token');
        const res = await fetch(`${BASE_URL}/roles/get`, {
          method: 'GET',
          headers: {
            ContentType: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await res.json();
        if (result.success) {
          setRoles(result.data.map((role: any) => ({
            _id: role._id,
            name: role.name,
          })));
        } else {
          console.error('Failed to fetch roles:', result.message);
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
      }
    };

    fetchRoles(); // ✅ 2. Fetch roles on mount
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token =
      Cookies.get('auth_token')

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      clientName: formData.client,
      email: formData.email,
      phoneNumber: parseInt(formData.phone.replace(/\D/g, '')),
      password: formData.password,
      role: formData.role,
      level: formData.level || undefined,
      is_active: formData.isActive === 'Active',
    };

    try {
      const response = await fetch(`${BASE_URL}/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('User created successfully!');
        console.log('Server Response:', result);
        setFormData(initialFormData); // Reset form
        router.push('/user/list');
      } else {
        console.error('Server error:', result);
        alert(`Failed to create user: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      alert('An error occurred while submitting the form.');
    }
  };


  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Add New User
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* First Name and Last Name */}
        <div className="flex flex-col md:flex-row gap-4">
          <FloatInput
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
          />
          <FloatInput
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
          />
        </div>

        <FloatInput
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
        />

        <FloatInput
          type="tel"
          name="phone"
          placeholder="Phone (e.g. +911234567890)"
          value={formData.phone}
          onChange={handleChange}
          pattern="^\+\d{1,3}\d{10}$"
          title="Include country code. E.g., +911234567890"
        />

        <FloatInput
          type="text"
          name="client"
          placeholder="Client Name"
          value={formData.client}
          onChange={handleChange}
        />

        <FloatInput
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
        />

        {/* ✅ 3. Role Dropdown populated from API */}
        <div className="relative w-full">
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className="peer w-full px-3 pt-5 pb-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
          >
            <option value="" disabled hidden></option>
            {roles.map((role) => (
              <option key={role._id} value={role._id}>
                {role.name}
              </option>
            ))}
          </select>
          <span className="absolute left-3 top-2 text-s text-gray-500 dark:text-gray-400 transition-all duration-200 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-500 dark:peer-focus:text-blue-400">
            Select Role
          </span>
        </div>

        {/* Level Dropdown */}
        <div className="relative w-full">
          <select
            name="level"
            value={formData.level}
            onChange={handleChange}
            className="peer w-full px-3 pt-5 pb-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
          >
            <option value="" disabled hidden></option>
            <option value="L1">L1</option>
            <option value="L2">L2</option>
            <option value="L3">L3</option>
          </select>
          <span className="absolute left-3 top-2 text-s text-gray-500 dark:text-gray-400 transition-all duration-200 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-500 dark:peer-focus:text-blue-400">
            Level (optional)
          </span>
        </div>

        {/* Is Active Dropdown */}
        <div className="relative w-full">
          <select
            name="isActive"
            value={formData.isActive}
            onChange={handleChange}
            required
            className="peer w-full px-3 pt-5 pb-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
          >
            <option value="" disabled hidden></option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <span className="absolute left-3 top-2 text-s text-gray-500 dark:text-gray-400 transition-all duration-200 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-500 dark:peer-focus:text-blue-400">
            Is Active
          </span>
        </div>

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
