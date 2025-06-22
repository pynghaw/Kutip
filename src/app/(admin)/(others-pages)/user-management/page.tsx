"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';

interface User {
  user_id: number;
  username: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'driver';
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface EditUserData {
  username: string;
  email: string;
  phone: string;
  role: 'admin' | 'driver';
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<EditUserData>({
    username: '',
    email: '',
    phone: '',
    role: 'driver',
    first_name: '',
    last_name: '',
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filter states
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'driver'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on current filters
  const filteredUsers = users.filter(user => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active) || 
      (statusFilter === 'inactive' && !user.is_active);
    
    return matchesRole && matchesStatus;
  });

  // Get counts for each filter
  const getFilterCounts = () => {
    const totalUsers = users.length;
    const adminUsers = users.filter(user => user.role === 'admin').length;
    const driverUsers = users.filter(user => user.role === 'driver').length;
    const activeUsers = users.filter(user => user.is_active).length;
    const inactiveUsers = users.filter(user => !user.is_active).length;

    return { totalUsers, adminUsers, driverUsers, activeUsers, inactiveUsers };
  };

  const filterCounts = getFilterCounts();

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_active: user.is_active,
    });
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = (user: User) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/users/${editingUser.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setSuccess('User updated successfully!');
      setShowEditModal(false);
      fetchUsers(); // Refresh the user list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/users/${deletingUser.user_id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess('User deleted successfully!');
      setShowDeleteModal(false);
      fetchUsers(); // Refresh the user list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <PageBreadCrumb pageTitle="User Management" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system users and their roles</p>
        </div>
        <Link 
          href="/signup" 
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New User
        </Link>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Role Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'driver')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Roles ({filterCounts.totalUsers})</option>
              <option value="admin">Admin ({filterCounts.adminUsers})</option>
              <option value="driver">Driver ({filterCounts.driverUsers})</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Status ({filterCounts.totalUsers})</option>
              <option value="active">Active ({filterCounts.activeUsers})</option>
              <option value="inactive">Inactive ({filterCounts.inactiveUsers})</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">All Users</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} in the system
            {(roleFilter !== 'all' || statusFilter !== 'all') && (
              <span className="ml-2 text-brand-600 dark:text-brand-400">
                (filtered from {filterCounts.totalUsers} total)
              </span>
            )}
          </p>
          {(roleFilter !== 'all' || statusFilter !== 'all') && (
            <div className="mt-2 flex flex-wrap gap-2">
              {roleFilter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-brand-100 text-brand-800 rounded-full dark:bg-brand-900 dark:text-brand-200">
                  Role: {roleFilter}
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-brand-100 text-brand-800 rounded-full dark:bg-brand-900 dark:text-brand-200">
                  Status: {statusFilter}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                          <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
                            {user.first_name && user.last_name 
                              ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`
                              : user.username.charAt(0).toUpperCase()
                            }
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}`
                            : user.username
                          }
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new user.
              </p>
              <div className="mt-6">
                <Link
                  href="/signup"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-500 hover:bg-brand-600"
                >
                  Create User
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[999999]">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Edit User: {editingUser.username}
              </h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
                  {success}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={editFormData.first_name}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={editFormData.last_name}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={editFormData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={editFormData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={editFormData.role}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={editFormData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Active User
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors duration-200 ${
                      isSubmitting 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-brand-500 hover:bg-brand-600'
                    }`}
                  >
                    {isSubmitting ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[999999]">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4 mb-2">
                Delete User
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Are you sure you want to delete <strong>{deletingUser.username}</strong>? This action cannot be undone.
              </p>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
                  {success}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors duration-200 ${
                    isSubmitting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 