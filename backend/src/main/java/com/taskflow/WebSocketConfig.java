package com.taskflow;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.server.ResponseStatusException;
import io.jsonwebtoken.JwtException;

import java.util.List;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final JwtService jwtService;
    private final ProjectService projects;

    public WebSocketConfig(JwtService jwtService, ProjectService projects) {
        this.jwtService = jwtService;
        this.projects = projects;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOrigins("http://localhost:5173");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    accessor.setUser(authenticate(accessor));
                } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    authorizeSubscription(accessor);
                }
                return message;
            }
        });
    }

    private Authentication authenticate(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            throw new ResponseStatusException(FORBIDDEN, "WebSocket authentication is required");
        }
        try {
            String username = jwtService.usernameFrom(header.substring(7));
            return new UsernamePasswordAuthenticationToken(username, null, List.of());
        } catch (JwtException | IllegalArgumentException exception) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid WebSocket authentication");
        }
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.matches("/topic/projects/\\d+")
                || accessor.getUser() == null) {
            throw new ResponseStatusException(FORBIDDEN, "Project subscription is not allowed");
        }
        long projectId = Long.parseLong(destination.substring(destination.lastIndexOf('/') + 1));
        if (!projects.isProjectMember(projectId, accessor.getUser().getName())) {
            throw new ResponseStatusException(FORBIDDEN, "You are not a member of this project");
        }
    }
}
