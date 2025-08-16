import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { user, signUp, signIn, loading } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthdayText, setBirthdayText] = useState('');
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ageError, setAgeError] = useState('');

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const calculateAge = (birthDate: Date) => {
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const parseBirthday = (dateString: string): Date | null => {
    // Expected format: MM/DD/YYYY
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    const month = parseInt(parts[0]) - 1; // Month is 0-indexed
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    if (month < 0 || month > 11) return null;
    if (day < 1 || day > 31) return null;
    if (year < 1900 || year > new Date().getFullYear()) return null;
    
    return new Date(year, month, day);
  };

  const checkAgeRestriction = async (birthDate: Date) => {
    const age = calculateAge(birthDate);
    
    if (age < 15) {
      // Check if this birthday has been attempted before
      const { data: attempts } = await supabase
        .from('age_verification_attempts')
        .select('*')
        .eq('birthday', format(birthDate, 'yyyy-MM-dd'));

      if (attempts && attempts.length > 0) {
        setAgeError('You have already attempted to sign up with this birthday. You must be 15 or older to use this app.');
        return false;
      }

      // Record the attempt
      await supabase
        .from('age_verification_attempts')
        .insert({
          birthday: format(birthDate, 'yyyy-MM-dd'),
          ip_address: null, // We can't easily get IP on client side
          user_agent: navigator.userAgent
        });

      setAgeError('You must be 15 or older to use this app. You cannot try again until your 15th birthday.');
      return false;
    }

    setAgeError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAgeError('');

    try {
      if (isSignUp) {
        if (!birthdayText.trim()) {
          toast({
            title: 'Error',
            description: 'Please enter your birthday',
            variant: 'destructive'
          });
          return;
        }

        const birthday = parseBirthday(birthdayText);
        if (!birthday) {
          toast({
            title: 'Error',
            description: 'Please enter a valid birthday in MM/DD/YYYY format',
            variant: 'destructive'
          });
          return;
        }

        const isAgeValid = await checkAgeRestriction(birthday);
        if (!isAgeValid) {
          return;
        }

        const { error } = await signUp(email, password, {
          username,
          birthday: format(birthday, 'yyyy-MM-dd'),
          bio
        });

        if (error) {
          toast({
            title: 'Sign Up Error',
            description: error.message,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Success!',
            description: 'Check your email to confirm your account'
          });
        }
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          toast({
            title: 'Sign In Error',
            description: error.message,
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Rantrio</CardTitle>
          <CardDescription className="text-center">
            {isSignUp ? 'Create your account to join daily conversations' : 'Welcome back to Rantrio'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                minLength={6}
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Choose a username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input
                    id="birthday"
                    type="text"
                    value={birthdayText}
                    onChange={(e) => setBirthdayText(e.target.value)}
                    required
                    placeholder="MM/DD/YYYY"
                    maxLength={10}
                  />
                  <div className="text-xs text-muted-foreground">
                    Enter your birthday in MM/DD/YYYY format
                  </div>
                  {ageError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {ageError}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optional)</Label>
                  <Input
                    id="bio"
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself (max 50 characters)"
                    maxLength={50}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {bio.length}/50
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || !!ageError}>
              {isSubmitting ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;