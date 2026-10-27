import type { components } from './schema'

type S = components['schemas']

export type Author = S['AuthorResponse']
export type Category = S['CategoryResponse']
export type Book = S['BookResponse']
export type BookLookup = S['BookLookupResponse']
export type BookSuggestion = S['Suggestion']
export type Reservation = S['ReservationDetailsResponse']
export type ReservationStatus = S['ReservationDetailsResponse']['status']
export type Copy = S['CopyResponse']
export type CopyStatus = S['CopyResponse']['status']
export type ReaderSummary = S['ReaderSummaryResponse']
export type Reader = S['ReaderResponse']
export type User = S['UserResponse']
export type CurrentUser = S['CurrentUserResponse']
export type Role = S['UserResponse']['role']
export type Loan = S['LoanResponse']
export type LoanDetails = S['LoanDetailsResponse']
export type ReturnLoanResult = S['ReturnLoanResponse']
export type ReturnCondition = 'GOOD' | 'DAMAGED' | 'LOST'
export type Fine = S['FineResponse']
export type Suspension = S['SuspensionResponse']
export type LibraryConfiguration = S['LibraryConfigurationResponse']
export type LibraryRules = S['LibraryRulesResponse']
export type PenaltyPolicy = S['LibraryConfigurationResponse']['penaltyPolicy']
export type Dashboard = S['DashboardResponse']

export type Paged<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number }
