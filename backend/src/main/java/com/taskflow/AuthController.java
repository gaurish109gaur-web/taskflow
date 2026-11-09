package com.taskflow;

import com.taskflow.ApiModels.AuthToken;
import com.taskflow.ApiModels.LoginInput;
import com.taskflow.ApiModels.RegisterInput;
import com.taskflow.ApiModels.SignupInput;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final InvitationService invitations;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService,
                          InvitationService invitations) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.invitations = invitations;
    }

    @PostMapping("/login")
    public AuthToken login(@Valid @RequestBody LoginInput input) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(input.email().trim().toLowerCase(), input.password()));
        String username = authentication.getName();
        return new AuthToken(jwtService.issue(username), username, jwtService.expiration());
    }

    @PostMapping("/signup")
    public AuthToken signup(@Valid @RequestBody SignupInput input) {
        var result = invitations.signup(input);
        return new AuthToken(result.token(), result.username(), jwtService.expiration());
    }

    @PostMapping("/register")
    public AuthToken register(@Valid @RequestBody RegisterInput input) {
        var result = invitations.accept(input);
        return new AuthToken(result.token(), result.username(), jwtService.expiration());
    }
}
