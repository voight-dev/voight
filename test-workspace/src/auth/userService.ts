/**
 * User Service - Authentication and user management
 */

import { db } from '../db';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { generateToken, verifyToken } from '../utils/jwt';

interface User {
    id: string;
    email: string;
    password: string;
    name: string;
    createdAt: Date;
}

interface TokenPayload {
    userId: string;
    email: string;
    exp: number;
}

/**
 * User management class
 */
export class UserService {
    private tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Create a new user account
     */
    async createUser(email: string, password: string, name: string): Promise<User> {
        // Validate input
        if (!email || !password || !name) {
            throw new Error('Missing required fields');
        }

        // Check if user exists
        const existingUser = await db.users.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user object
        const user: User = {
            id: generateId(),
            email,
            password: hashedPassword,
            name,
            createdAt: new Date()
        };

        // Save to database
        await db.users.insertOne(user);

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
    }

    /**
     * Authenticate user and return token
     */
    async login(email: string, password: string): Promise<string> {
        // Find user
        const user = await db.users.findOne({ email });
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        // Generate token
        const token = generateToken({
            userId: user.id,
            email: user.email,
            exp: Date.now() + this.tokenExpiry
        });

        return token;
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: string): Promise<User | null> {
        const user = await db.users.findOne({ id: userId });
        if (!user) {
            return null;
        }

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
    }

    /**
     * Update user profile
     */
    async updateUser(userId: string, updates: Partial<User>): Promise<User> {
        const user = await db.users.findOne({ id: userId });
        if (!user) {
            throw new Error('User not found');
        }

        const updatedUser = { ...user, ...updates };
        await db.users.updateOne({ id: userId }, updatedUser);

        const { password: _, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword as User;
    }

    /**
     * Validate JWT token and return payload
     */
    async validateToken(token: string): Promise<TokenPayload> {
        try {
            const payload = verifyToken(token) as TokenPayload;

            // Check expiry
            if (payload.exp < Date.now()) {
                throw new Error('Token expired');
            }

            // Verify user still exists
            const user = await db.users.findOne({ id: payload.userId });
            if (!user) {
                throw new Error('User not found');
            }

            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Delete user account
     */
    async deleteUser(userId: string): Promise<void> {
        const user = await db.users.findOne({ id: userId });
        if (!user) {
            throw new Error('User not found');
        }

        await db.users.deleteOne({ id: userId });
    }
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
